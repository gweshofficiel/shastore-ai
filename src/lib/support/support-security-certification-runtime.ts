import "server-only";

import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type {
  SupportDataCertificationItem,
  SupportDataCertificationSummary
} from "@/src/lib/support/support-data-certification-runtime";
import type { SupportAuditRuntimeItem } from "@/src/lib/support/support-audit-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportReviewRuntimeItem } from "@/src/lib/support/support-review-runtime";
import type { SupportStatusRuntimeItem } from "@/src/lib/support/support-status-runtime";
import type { SupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";
import type { SupportVisibilityRuntimeItem } from "@/src/lib/support/support-visibility-runtime";

export type SupportSecurityCertificationSource = "support_security_certification_runtime";

export type SupportSecurityCertificationGroupKey =
  | "analytics-export-security-certification"
  | "data-certification-security-review"
  | "discovery-security-certification"
  | "events-security-certification"
  | "governance-security-certification"
  | "platform-security-certification"
  | "tickets-security-certification";

export type SupportSecurityCertificationStatus = "certified" | "review_required";

export type SupportSecurityCertificationLoadingState =
  | "certified"
  | "empty"
  | "error"
  | "restricted"
  | "unauthorized";

export type SupportSecurityCertificationSafeControlKey =
  | "approve_security_certification"
  | "export_security_report"
  | "mark_security_certified"
  | "recheck_security"
  | "resolve_security_blocker";

export type SupportSecurityCertificationSafeControl = {
  enabled: false;
  key: SupportSecurityCertificationSafeControlKey;
  label: string;
  note: string;
};

export type SupportSecurityCertificationItem = {
  actionSafetyStatus: SupportSecurityCertificationStatus;
  blockedModules: number;
  certificationName: string;
  certificationScope: string;
  certifiedModules: number;
  executionSafetyStatus: SupportSecurityCertificationStatus;
  groupKey: SupportSecurityCertificationGroupKey;
  mutationSafetyStatus: SupportSecurityCertificationStatus;
  privateDataSafetyStatus: SupportSecurityCertificationStatus;
  readOnlyStatus: SupportSecurityCertificationStatus;
  rlsSafetyStatus: SupportSecurityCertificationStatus;
  safeControls: SupportSecurityCertificationSafeControl[];
  safeSummary: string;
  secretSafetyStatus: SupportSecurityCertificationStatus;
  securityCertificationKey: string;
  superAdminOnlyStatus: SupportSecurityCertificationStatus;
  visibilitySafetyStatus: SupportSecurityCertificationStatus;
  warningModules: number;
};

export type SupportSecurityCertificationGroup = {
  groupKey: SupportSecurityCertificationGroupKey;
  itemCount: number;
  items: SupportSecurityCertificationItem[];
  title: string;
};

export type SupportSecurityCertificationSummary = {
  blockedScopes: number;
  certifiedScopes: number;
  emptyMessage: string | null;
  groupCount: number;
  loadError: string | null;
  loadingState: SupportSecurityCertificationLoadingState;
  overallStatus: "needs_attention" | "support_security_certification_ready";
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  reviewRequiredScopes: number;
  source: SupportSecurityCertificationSource;
  summary: string;
  totalCertifications: number;
  unauthorizedMessage: string | null;
  warningScopes: number;
};

export type SupportSecurityCertificationRuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

export type SupportSecurityCertificationAuthorization = {
  canViewSecurityCertification: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportSecurityCertificationInput = {
  analyticsRuntime: SupportSecurityCertificationRuntimeSnapshot;
  auditItems: Array<Pick<SupportAuditRuntimeItem, "registryKey" | "safeSummary">>;
  auditRuntime: SupportSecurityCertificationRuntimeSnapshot;
  authorization: SupportSecurityCertificationAuthorization;
  dashboardRuntime: SupportSecurityCertificationRuntimeSnapshot;
  dataCertification: SupportDataCertificationSummary;
  dataCertificationItems: SupportDataCertificationItem[];
  errorEventsRuntime: SupportSecurityCertificationRuntimeSnapshot;
  eventTimelineRuntime: SupportSecurityCertificationRuntimeSnapshot;
  exportRuntime: SupportSecurityCertificationRuntimeSnapshot;
  filtersRuntime: SupportSecurityCertificationRuntimeSnapshot;
  hiddenRecordCount?: number;
  loadError?: string | null;
  metricsRuntime: SupportSecurityCertificationRuntimeSnapshot;
  monitoringEventsRuntime: SupportSecurityCertificationRuntimeSnapshot;
  notificationsRuntime: SupportSecurityCertificationRuntimeSnapshot;
  registryRuntime: SupportSecurityCertificationRuntimeSnapshot;
  restrictedRecordCount?: number;
  reviewItems: Array<Pick<SupportReviewRuntimeItem, "registryKey" | "reviewStatus" | "safeSummary">>;
  reviewRuntime: SupportSecurityCertificationRuntimeSnapshot;
  role: "internal_team" | "super_admin";
  safeActionsRuntime: SupportSecurityCertificationRuntimeSnapshot & { superAdminOnly?: boolean };
  searchRuntime: SupportSecurityCertificationRuntimeSnapshot;
  statusItems: Array<Pick<SupportStatusRuntimeItem, "registryKey" | "safeSummary">>;
  statusRuntime: SupportSecurityCertificationRuntimeSnapshot;
  ticketAssignmentRuntime: SupportSecurityCertificationRuntimeSnapshot;
  ticketConversationRuntime: SupportSecurityCertificationRuntimeSnapshot;
  ticketDetailsRuntime: SupportSecurityCertificationRuntimeSnapshot;
  ticketStatusRuntime: SupportSecurityCertificationRuntimeSnapshot;
  ticketsRuntime: SupportSecurityCertificationRuntimeSnapshot;
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibilityItems: Array<Pick<SupportVisibilityRuntimeItem, "registryKey" | "safeSummary" | "visibility">>;
  visibilityRuntime: SupportSecurityCertificationRuntimeSnapshot;
};

type SecurityScopeDefinition = {
  certificationName: string;
  certificationScope: string;
  dataCertificationKey: string | null;
  expectedSources: readonly string[];
  groupKey: SupportSecurityCertificationGroupKey;
  registryKeys: readonly (string | null)[];
  resolveRuntimeSnapshots: (input: SupportSecurityCertificationInput) => SupportSecurityCertificationRuntimeSnapshot[];
};

export const SUPPORT_SECURITY_CERTIFICATION_SOURCE = "support_security_certification_runtime" as const;

export const SUPPORT_SECURITY_CERTIFICATION_SAFE_CONTROLS: readonly SupportSecurityCertificationSafeControl[] = [
  {
    enabled: false,
    key: "approve_security_certification",
    label: "Approve Security Certification",
    note: "Read-only placeholder. No security certification approval or mutation runs during SP-23 page load."
  },
  {
    enabled: false,
    key: "recheck_security",
    label: "Recheck Security",
    note: "Read-only placeholder. No security recheck execution or data mutation runs during SP-23 page load."
  },
  {
    enabled: false,
    key: "export_security_report",
    label: "Export Security Report",
    note: "Read-only placeholder. No security export runs during SP-23 page load."
  },
  {
    enabled: false,
    key: "resolve_security_blocker",
    label: "Resolve Security Blocker",
    note: "Read-only placeholder. No security blocker resolve action runs during SP-23 page load."
  },
  {
    enabled: false,
    key: "mark_security_certified",
    label: "Mark Security Certified",
    note: "Read-only placeholder. No security certification record write runs during SP-23 page load."
  }
] as const;

const SECURITY_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportSecurityCertificationGroupKey;
  title: string;
}> = [
  { groupKey: "platform-security-certification", title: "Platform Security Certification" },
  { groupKey: "tickets-security-certification", title: "Tickets Security Certification" },
  { groupKey: "events-security-certification", title: "Events Security Certification" },
  { groupKey: "discovery-security-certification", title: "Discovery Security Certification" },
  { groupKey: "governance-security-certification", title: "Governance Security Certification" },
  { groupKey: "analytics-export-security-certification", title: "Analytics & Export Security Certification" },
  { groupKey: "data-certification-security-review", title: "Data Certification Security Review" }
];

const SECURITY_SCOPE_DEFINITIONS: readonly SecurityScopeDefinition[] = [
  {
    certificationName: "Support Registry Security Certification",
    certificationScope: "SP-1 Support Registry Super Admin read-only security metadata",
    dataCertificationKey: "sp-cert-registry-data",
    expectedSources: [SUPPORT_REGISTRY_SOURCE],
    groupKey: "platform-security-certification",
    registryKeys: [null],
    resolveRuntimeSnapshots: (input) => [input.registryRuntime]
  },
  {
    certificationName: "Support Dashboard Security Certification",
    certificationScope: "SP-2 Support Dashboard Super Admin read-only security metadata",
    dataCertificationKey: "sp-cert-dashboard-data",
    expectedSources: ["support_dashboard_runtime"],
    groupKey: "platform-security-certification",
    registryKeys: ["sp-dashboard"],
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime]
  },
  {
    certificationName: "Tickets Security Certification",
    certificationScope: "SP-3 Support Tickets read-only security metadata",
    dataCertificationKey: "sp-cert-tickets-data",
    expectedSources: ["support_tickets_runtime"],
    groupKey: "tickets-security-certification",
    registryKeys: ["sp-tickets"],
    resolveRuntimeSnapshots: (input) => [input.ticketsRuntime]
  },
  {
    certificationName: "Ticket Details Security Certification",
    certificationScope: "SP-4 Support Ticket Details read-only security metadata",
    dataCertificationKey: "sp-cert-ticket-details-data",
    expectedSources: ["support_ticket_details_runtime"],
    groupKey: "tickets-security-certification",
    registryKeys: ["sp-ticket-details"],
    resolveRuntimeSnapshots: (input) => [input.ticketDetailsRuntime]
  },
  {
    certificationName: "Ticket Status Security Certification",
    certificationScope: "SP-5 Support Ticket Status read-only security metadata",
    dataCertificationKey: "sp-cert-ticket-status-data",
    expectedSources: ["support_ticket_status_runtime"],
    groupKey: "tickets-security-certification",
    registryKeys: ["sp-ticket-status"],
    resolveRuntimeSnapshots: (input) => [input.ticketStatusRuntime]
  },
  {
    certificationName: "Ticket Assignment Security Certification",
    certificationScope: "SP-6 Support Ticket Assignment read-only security metadata",
    dataCertificationKey: "sp-cert-ticket-assignment-data",
    expectedSources: ["support_ticket_assignment_runtime"],
    groupKey: "tickets-security-certification",
    registryKeys: ["sp-ticket-assignment"],
    resolveRuntimeSnapshots: (input) => [input.ticketAssignmentRuntime]
  },
  {
    certificationName: "Ticket Conversation Security Certification",
    certificationScope: "SP-7 Support Ticket Conversation read-only security metadata",
    dataCertificationKey: "sp-cert-ticket-conversation-data",
    expectedSources: ["support_ticket_conversation_runtime"],
    groupKey: "tickets-security-certification",
    registryKeys: ["sp-ticket-conversation"],
    resolveRuntimeSnapshots: (input) => [input.ticketConversationRuntime]
  },
  {
    certificationName: "Monitoring Events Security Certification",
    certificationScope: "SP-8 Support Monitoring Events read-only security metadata",
    dataCertificationKey: "sp-cert-monitoring-events-data",
    expectedSources: ["support_monitoring_events_runtime"],
    groupKey: "events-security-certification",
    registryKeys: ["sp-monitoring-events"],
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime]
  },
  {
    certificationName: "Error Events Security Certification",
    certificationScope: "SP-9 Support Error Events read-only security metadata",
    dataCertificationKey: "sp-cert-error-events-data",
    expectedSources: ["support_error_events_runtime"],
    groupKey: "events-security-certification",
    registryKeys: ["sp-error-events"],
    resolveRuntimeSnapshots: (input) => [input.errorEventsRuntime]
  },
  {
    certificationName: "Event Timeline Security Certification",
    certificationScope: "SP-10 Support Event Timeline read-only security metadata",
    dataCertificationKey: "sp-cert-event-timeline-data",
    expectedSources: ["support_event_timeline_runtime"],
    groupKey: "events-security-certification",
    registryKeys: ["sp-event-timeline"],
    resolveRuntimeSnapshots: (input) => [input.eventTimelineRuntime]
  },
  {
    certificationName: "Search Security Certification",
    certificationScope: "SP-11 Support Search read-only security metadata",
    dataCertificationKey: "sp-cert-search-data",
    expectedSources: ["support_search_runtime"],
    groupKey: "discovery-security-certification",
    registryKeys: ["sp-search"],
    resolveRuntimeSnapshots: (input) => [input.searchRuntime]
  },
  {
    certificationName: "Filters Security Certification",
    certificationScope: "SP-12 Support Filters read-only security metadata",
    dataCertificationKey: "sp-cert-filters-data",
    expectedSources: ["support_filters_runtime"],
    groupKey: "discovery-security-certification",
    registryKeys: ["sp-filters"],
    resolveRuntimeSnapshots: (input) => [input.filtersRuntime]
  },
  {
    certificationName: "Metrics Security Certification",
    certificationScope: "SP-13 Support Metrics read-only security metadata",
    dataCertificationKey: "sp-cert-metrics-data",
    expectedSources: ["support_metrics_runtime"],
    groupKey: "discovery-security-certification",
    registryKeys: ["sp-metrics"],
    resolveRuntimeSnapshots: (input) => [input.metricsRuntime]
  },
  {
    certificationName: "Visibility Security Certification",
    certificationScope: "SP-14 Support Visibility read-only security metadata",
    dataCertificationKey: "sp-cert-visibility-data",
    expectedSources: ["support_visibility_runtime"],
    groupKey: "governance-security-certification",
    registryKeys: ["sp-visibility"],
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime]
  },
  {
    certificationName: "Safe Actions Security Certification",
    certificationScope: "SP-15 Support Safe Actions explicit Super Admin authorization boundaries",
    dataCertificationKey: "sp-cert-safe-actions-data",
    expectedSources: ["support_safe_actions_runtime"],
    groupKey: "governance-security-certification",
    registryKeys: ["sp-safe-actions"],
    resolveRuntimeSnapshots: (input) => [input.safeActionsRuntime]
  },
  {
    certificationName: "Audit Security Certification",
    certificationScope: "SP-16 Support Audit read-only security metadata",
    dataCertificationKey: "sp-cert-audit-data",
    expectedSources: ["support_audit_runtime"],
    groupKey: "governance-security-certification",
    registryKeys: ["sp-audit"],
    resolveRuntimeSnapshots: (input) => [input.auditRuntime]
  },
  {
    certificationName: "Review Security Certification",
    certificationScope: "SP-17 Support Review read-only security metadata",
    dataCertificationKey: "sp-cert-review-data",
    expectedSources: ["support_review_runtime"],
    groupKey: "governance-security-certification",
    registryKeys: ["sp-review"],
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime]
  },
  {
    certificationName: "Notifications Security Certification",
    certificationScope: "SP-18 Support Notifications read-only security metadata",
    dataCertificationKey: "sp-cert-notifications-data",
    expectedSources: ["support_notifications_runtime"],
    groupKey: "governance-security-certification",
    registryKeys: ["sp-notifications"],
    resolveRuntimeSnapshots: (input) => [input.notificationsRuntime]
  },
  {
    certificationName: "Analytics Security Certification",
    certificationScope: "SP-19 Support Analytics read-only security metadata",
    dataCertificationKey: "sp-cert-analytics-data",
    expectedSources: ["support_analytics_runtime"],
    groupKey: "analytics-export-security-certification",
    registryKeys: ["sp-analytics"],
    resolveRuntimeSnapshots: (input) => [input.analyticsRuntime]
  },
  {
    certificationName: "Export Security Certification",
    certificationScope: "SP-20 Support Export explicit Super Admin download security metadata",
    dataCertificationKey: "sp-cert-export-data",
    expectedSources: ["support_export_runtime"],
    groupKey: "analytics-export-security-certification",
    registryKeys: ["sp-export"],
    resolveRuntimeSnapshots: (input) => [input.exportRuntime]
  },
  {
    certificationName: "Status Security Certification",
    certificationScope: "SP-21 Support Status read-only security metadata",
    dataCertificationKey: "sp-cert-status-data",
    expectedSources: ["support_status_runtime"],
    groupKey: "analytics-export-security-certification",
    registryKeys: ["sp-status"],
    resolveRuntimeSnapshots: (input) => [input.statusRuntime]
  },
  {
    certificationName: "Data Certification Security Review",
    certificationScope: "SP-22 Support Data Certification read-only security metadata",
    dataCertificationKey: null,
    expectedSources: ["support_data_certification_runtime"],
    groupKey: "data-certification-security-review",
    registryKeys: ["sp-data-certification"],
    resolveRuntimeSnapshots: (input) => [input.dataCertification]
  }
] as const;

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|authorization:\s*bearer|sb_secret|smtp|webhook|stack trace|provider payload|payment data|internal credential)/i;

const privateDataPattern =
  /(?:customer[_-]?(?:email|phone|name|address)|user[_-]?(?:email|phone|name)|full[_-]?name|message_body|raw metadata)/i;

const rlsWeakeningPattern = /(?:rls\s+disabled|disable\s+rls|policy\s+removed|weaken\s+policy|bypass\s+rls|client-side bypass)/i;

const unsafeExecutionPattern =
  /(?:execute\s+queue|run\s+worker|trigger\s+cron|enqueue|auto-heal|auto-fix|seed\s+data|upsert\s+during page load)/i;

function buildSafeControls() {
  return SUPPORT_SECURITY_CERTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function sanitizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return maskSensitiveText(value).slice(0, maxLength);
}

function collectRegistryCounts(input: SupportSecurityCertificationInput, registryKeys: readonly (string | null)[]) {
  const scopedKeys = registryKeys.filter((key): key is string => Boolean(key));
  const reviewItems = input.reviewItems.filter((item) => scopedKeys.includes(item.registryKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    certifiedModules: reviewItems.filter((item) => item.reviewStatus === "clear").length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function collectSafeTexts(input: SupportSecurityCertificationInput, registryKeys: readonly (string | null)[]) {
  const scopedKeys = registryKeys.filter((key): key is string => Boolean(key));

  return [
    ...input.statusItems.filter((item) => scopedKeys.includes(item.registryKey)).map((item) => sanitizeText(item.safeSummary)),
    ...input.visibilityItems.filter((item) => scopedKeys.includes(item.registryKey)).map((item) => sanitizeText(item.safeSummary)),
    ...input.auditItems.filter((item) => scopedKeys.includes(item.registryKey)).map((item) => sanitizeText(item.safeSummary)),
    ...input.reviewItems.filter((item) => scopedKeys.includes(item.registryKey)).map((item) => sanitizeText(item.safeSummary))
  ];
}

function validateSuperAdminOnly(registryKeys: readonly (string | null)[]) {
  const scopedKeys = registryKeys.filter((key): key is string => Boolean(key));

  if (!scopedKeys.length) {
    return "certified" as const;
  }

  return scopedKeys.every((key) => {
    const entry = getSupportRegistryEntry(key);

    return (
      entry !== null &&
      entry.visibility === "super_admin" &&
      entry.permissions.every((permission) => permission.startsWith("super_admin"))
    );
  })
    ? ("certified" as const)
    : ("review_required" as const);
}

function validateReadOnly(snapshots: SupportSecurityCertificationRuntimeSnapshot[]) {
  return snapshots.every((snapshot) => snapshot.readOnly === true) ? ("certified" as const) : ("review_required" as const);
}

function validateMutationSafety(snapshots: SupportSecurityCertificationRuntimeSnapshot[], texts: string[]) {
  if (!snapshots.every((snapshot) => snapshot.readOnly === true)) {
    return "review_required" as const;
  }

  const combined = texts.join(" ").toLowerCase();

  if (/no mutation|read-only|without mutation|does not mutate|no .* mutation/.test(combined) || combined.length === 0) {
    return "certified" as const;
  }

  if (/\b(insert|update|delete|upsert|seed)\b/.test(combined) && !/no (insert|update|delete|upsert|seed)/.test(combined)) {
    return "review_required" as const;
  }

  return "certified" as const;
}

function validateExecutionSafety(texts: string[]) {
  const combined = texts.join(" ").toLowerCase();

  if (unsafeExecutionPattern.test(combined)) {
    return "review_required" as const;
  }

  if (/no execution|read-only page load|without execution|does not execute|explicit.*download|disabled safe control|no export runs during page load/.test(combined)) {
    return "certified" as const;
  }

  return texts.length > 0 ? ("certified" as const) : ("review_required" as const);
}

function validateSecretSafety(texts: string[]) {
  return texts.every((value) => !secretPattern.test(value)) ? ("certified" as const) : ("review_required" as const);
}

function validatePrivateDataSafety(texts: string[]) {
  return texts.every((value) => !privateDataPattern.test(value)) ? ("certified" as const) : ("review_required" as const);
}

function validateRlsSafety(texts: string[]) {
  return texts.every((value) => !rlsWeakeningPattern.test(value)) ? ("certified" as const) : ("review_required" as const);
}

function validateVisibilitySafety(
  definition: SecurityScopeDefinition,
  input: SupportSecurityCertificationInput
) {
  if (definition.registryKeys.includes("sp-visibility")) {
    if (!input.visibilityAuthorization.canViewSupportData) {
      return "review_required" as const;
    }

    const combined = [
      sanitizeText(input.visibilityRuntime.summary),
      ...input.visibilityItems.map((item) => sanitizeText(item.safeSummary))
    ].join(" ").toLowerCase();

    if (/bypass|hidden without rule|rls disabled/.test(combined)) {
      return "review_required" as const;
    }

    return "certified" as const;
  }

  const scopedKeys = definition.registryKeys.filter((key): key is string => Boolean(key));
  const visibilityItems = input.visibilityItems.filter((item) => scopedKeys.includes(item.registryKey));

  if (!visibilityItems.length) {
    return "certified" as const;
  }

  return visibilityItems.every((item) => item.visibility !== "hidden" || item.registryKey === "sp-visibility")
    ? ("certified" as const)
    : ("review_required" as const);
}

function validateActionSafety(definition: SecurityScopeDefinition, input: SupportSecurityCertificationInput) {
  if (definition.groupKey === "governance-security-certification" && definition.registryKeys.includes("sp-safe-actions")) {
    const summary = sanitizeText(input.safeActionsRuntime.summary).toLowerCase();

    if (input.safeActionsRuntime.superAdminOnly !== true) {
      return "review_required" as const;
    }

    if (!/super admin|explicit|form submission|authorization/.test(summary)) {
      return "review_required" as const;
    }

    return "certified" as const;
  }

  if (definition.registryKeys.includes("sp-export")) {
    const summary = sanitizeText(input.exportRuntime.summary).toLowerCase();

    if (input.exportRuntime.readOnly !== true) {
      return "review_required" as const;
    }

    if (!/explicit|download only|no export runs during page load|super admin/.test(summary)) {
      return "review_required" as const;
    }

    return "certified" as const;
  }

  if (definition.groupKey === "data-certification-security-review") {
    return input.dataCertificationItems.every(
      (item) => item.secretSafetyStatus === "safe" && item.mutationSafetyStatus === "read_only_certified"
    ) && input.dataCertification.readOnly === true
      ? ("certified" as const)
      : ("review_required" as const);
  }

  return "certified" as const;
}

function findDataCertificationItem(input: SupportSecurityCertificationInput, definition: SecurityScopeDefinition) {
  if (definition.groupKey === "data-certification-security-review" || !definition.dataCertificationKey) {
    return null;
  }

  return input.dataCertificationItems.find((item) => item.certificationKey === definition.dataCertificationKey) ?? null;
}

function resolveScopeCounts(input: {
  dataCertificationItem: SupportDataCertificationItem | null;
  dataCertificationSummary: SupportDataCertificationSummary | null;
  moduleCounts: ReturnType<typeof collectRegistryCounts>;
}) {
  if (input.dataCertificationSummary) {
    return {
      blockedModules: input.dataCertificationSummary.blockedScopes,
      certifiedModules: input.dataCertificationSummary.certifiedScopes,
      warningModules: input.dataCertificationSummary.warningScopes
    };
  }

  return {
    blockedModules: Math.max(input.moduleCounts.blockedModules, input.dataCertificationItem?.blockedModules ?? 0),
    certifiedModules: Math.max(input.moduleCounts.certifiedModules, input.dataCertificationItem?.certifiedModules ?? 0),
    warningModules: Math.max(input.moduleCounts.warningModules, input.dataCertificationItem?.warningModules ?? 0)
  };
}

function buildSecurityCertificationItem(
  definition: SecurityScopeDefinition,
  input: SupportSecurityCertificationInput
): SupportSecurityCertificationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const dataCertificationItem = findDataCertificationItem(input, definition);
  const dataCertificationSummary =
    definition.groupKey === "data-certification-security-review" ? input.dataCertification : null;
  const texts = [
    ...snapshots.map((snapshot) => sanitizeText(snapshot.summary)),
    ...collectSafeTexts(input, definition.registryKeys),
    ...(dataCertificationItem ? [sanitizeText(dataCertificationItem.safeSummary)] : []),
    ...(dataCertificationSummary ? [sanitizeText(dataCertificationSummary.summary)] : []),
    ...(definition.groupKey === "data-certification-security-review"
      ? input.dataCertificationItems.map((item) => sanitizeText(item.safeSummary))
      : [])
  ];
  const moduleCounts = collectRegistryCounts(input, definition.registryKeys);
  const counts = resolveScopeCounts({
    dataCertificationItem,
    dataCertificationSummary,
    moduleCounts
  });
  const superAdminOnlyStatus = validateSuperAdminOnly(definition.registryKeys);
  const readOnlyStatus = validateReadOnly(snapshots);
  const mutationSafetyStatus = validateMutationSafety(snapshots, texts);
  const executionSafetyStatus = validateExecutionSafety(texts);
  const secretSafetyStatus = validateSecretSafety(texts);
  const privateDataSafetyStatus = validatePrivateDataSafety(texts);
  const rlsSafetyStatus = validateRlsSafety(texts);
  const visibilitySafetyStatus = validateVisibilitySafety(definition, input);
  const actionSafetyStatus = validateActionSafety(definition, input);

  return {
    actionSafetyStatus,
    blockedModules: counts.blockedModules,
    certificationName: definition.certificationName,
    certificationScope: definition.certificationScope,
    certifiedModules: counts.certifiedModules,
    executionSafetyStatus,
    groupKey: definition.groupKey,
    mutationSafetyStatus,
    privateDataSafetyStatus,
    readOnlyStatus,
    rlsSafetyStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `scope ${definition.certificationScope}`,
      `super admin ${superAdminOnlyStatus}`,
      `read only ${readOnlyStatus}`,
      `visibility ${visibilitySafetyStatus}`,
      `secrets ${secretSafetyStatus}`,
      `private data ${privateDataSafetyStatus}`,
      `rls ${rlsSafetyStatus}`,
      `execution ${executionSafetyStatus}`,
      `actions ${actionSafetyStatus}`,
      `${counts.blockedModules} blocked`,
      `${counts.warningModules} warning`
    ].join("; "),
    secretSafetyStatus,
    securityCertificationKey: `sp-sec-${definition.dataCertificationKey ?? definition.groupKey}`,
    superAdminOnlyStatus,
    visibilitySafetyStatus,
    warningModules: counts.warningModules
  };
}

export function resolveSupportSecurityCertificationAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportSecurityCertificationAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewSecurityCertification: true,
      reason: "Super Admin may view Support security certification through read-only runtime validation.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewSecurityCertification: false,
    reason: "Support security certification is restricted to Super Admin in SP-23.",
    roleLabel: input.role
  };
}

export function supportSecurityCertificationStatusLabel(status: SupportSecurityCertificationStatus) {
  return status === "certified" ? "Certified" : "Review Required";
}

export function supportSecurityCertificationStatusTone(status: SupportSecurityCertificationStatus) {
  return status === "certified" ? ("green" as const) : ("amber" as const);
}

export function supportSecurityCertificationRuntimeStatusBadgeTone(
  status: SupportSecurityCertificationSummary["overallStatus"]
): "amber" | "green" {
  return status === "support_security_certification_ready" ? "green" : "amber";
}

export function isSupportSecurityScopeCertified(item: SupportSecurityCertificationItem) {
  return [
    item.superAdminOnlyStatus,
    item.readOnlyStatus,
    item.mutationSafetyStatus,
    item.executionSafetyStatus,
    item.secretSafetyStatus,
    item.privateDataSafetyStatus,
    item.rlsSafetyStatus,
    item.visibilitySafetyStatus,
    item.actionSafetyStatus
  ].every((status) => status === "certified");
}

export function buildSupportSecurityCertificationGroups(
  items: SupportSecurityCertificationItem[]
): SupportSecurityCertificationGroup[] {
  return SECURITY_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

function getSupportSecurityCertificationSummary(
  items: SupportSecurityCertificationItem[],
  input: Pick<
    SupportSecurityCertificationInput,
    "authorization" | "hiddenRecordCount" | "loadError" | "restrictedRecordCount" | "role" | "visibilityAuthorization"
  >
): SupportSecurityCertificationSummary {
  const registryEntry = getSupportRegistryEntry("sp-security-certification");
  const hiddenRecordCount = input.hiddenRecordCount ?? 0;
  const restrictedRecordCount = input.restrictedRecordCount ?? 0;

  if (
    !input.authorization.canViewSecurityCertification ||
    !input.visibilityAuthorization.canViewSupportData ||
    input.role !== "super_admin"
  ) {
    return {
      blockedScopes: 0,
      certifiedScopes: 0,
      emptyMessage: "Support security certification is hidden for the current account.",
      groupCount: 0,
      loadError: null,
      loadingState: "unauthorized",
      overallStatus: "needs_attention",
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: SECURITY_SCOPE_DEFINITIONS.length,
      source: SUPPORT_SECURITY_CERTIFICATION_SOURCE,
      summary: input.authorization.reason,
      totalCertifications: SECURITY_SCOPE_DEFINITIONS.length,
      unauthorizedMessage:
        "Support security certification is Super Admin only. No security mutation runs during page load.",
      warningScopes: 0
    };
  }

  if (input.loadError) {
    return {
      blockedScopes: items.length,
      certifiedScopes: 0,
      emptyMessage: null,
      groupCount: 0,
      loadError: input.loadError,
      loadingState: "error",
      overallStatus: "needs_attention",
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: items.length,
      source: SUPPORT_SECURITY_CERTIFICATION_SOURCE,
      summary: `status load_error; ${input.loadError}`,
      totalCertifications: items.length,
      unauthorizedMessage: null,
      warningScopes: 0
    };
  }

  const certifiedScopes = items.filter((item) => isSupportSecurityScopeCertified(item) && item.blockedModules === 0).length;
  const reviewRequiredScopes = items.filter((item) => !isSupportSecurityScopeCertified(item)).length;
  const blockedScopes = items.filter((item) => item.blockedModules > 0).length;
  const warningScopes = items.filter((item) => item.warningModules > 0).length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 ? ("needs_attention" as const) : ("support_security_certification_ready" as const);
  const loadingState: SupportSecurityCertificationLoadingState =
    restrictedRecordCount > 0
      ? "restricted"
      : certifiedScopes === 0
        ? "empty"
        : overallStatus === "support_security_certification_ready"
          ? "certified"
          : "restricted";

  return {
    blockedScopes,
    certifiedScopes,
    emptyMessage:
      certifiedScopes === 0 ? "No Support security scopes are fully certified for the current runtime snapshot." : null,
    groupCount: buildSupportSecurityCertificationGroups(items).length,
    loadError: null,
    loadingState,
    overallStatus,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      restrictedRecordCount > 0
        ? `${restrictedRecordCount} record(s) excluded from Support security certification under SP-14 visibility rules.`
        : null,
    reviewRequiredScopes,
    source: SUPPORT_SECURITY_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} security scopes`,
      `${certifiedScopes} certified`,
      `${reviewRequiredScopes} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`,
      `${hiddenRecordCount} hidden`,
      registryEntry?.productionReady ? "registry production_ready" : "registry pending"
    ].join("; "),
    totalCertifications: items.length,
    unauthorizedMessage: null,
    warningScopes
  };
}

export function buildSupportSecurityCertificationReadOnlySafe(input: SupportSecurityCertificationInput) {
  const securityCertificationItems = SECURITY_SCOPE_DEFINITIONS.map((definition) =>
    buildSecurityCertificationItem(definition, input)
  );
  const groups = buildSupportSecurityCertificationGroups(securityCertificationItems);
  const securityCertification = getSupportSecurityCertificationSummary(securityCertificationItems, input);

  return {
    securityCertification,
    securityCertificationGroups: groups,
    securityCertificationItems,
    securityCertificationSafeControls: buildSafeControls()
  };
}

export function mapSupportSecurityCertificationToAdminFields(
  input: ReturnType<typeof buildSupportSecurityCertificationReadOnlySafe>
) {
  return input;
}

export function toSupportSecurityCertificationSnapshot(input: {
  readOnly?: boolean;
  source?: string;
  status?: string;
  summary?: string;
}): SupportSecurityCertificationRuntimeSnapshot {
  return {
    readOnly: input.readOnly ?? true,
    source: input.source,
    summary: input.summary
  };
}
