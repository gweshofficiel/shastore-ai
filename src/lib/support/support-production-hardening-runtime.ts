import "server-only";

import type { SupportDataCertificationSummary } from "@/src/lib/support/support-data-certification-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type {
  SupportProductionCertificationItem,
  SupportProductionCertificationSummary
} from "@/src/lib/support/support-production-certification-runtime";
import type { SupportReviewRuntimeItem } from "@/src/lib/support/support-review-runtime";
import type { SupportRuntimeCertificationSummary } from "@/src/lib/support/support-runtime-certification-runtime";
import type {
  SupportSecurityCertificationItem,
  SupportSecurityCertificationSummary
} from "@/src/lib/support/support-security-certification-runtime";
import {
  isSupportStressScopeStable,
  type SupportStressValidationItem,
  type SupportStressValidationSummary
} from "@/src/lib/support/support-stress-validation-runtime";
import type { SupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";

export type SupportProductionHardeningSource = "support_production_hardening_runtime";

export type SupportProductionHardeningGroupKey =
  | "analytics-hardening"
  | "audit-hardening"
  | "certification-hardening"
  | "dashboard-hardening"
  | "error-events-hardening"
  | "event-timeline-hardening"
  | "export-hardening"
  | "filters-hardening"
  | "metrics-hardening"
  | "monitoring-events-hardening"
  | "notifications-hardening"
  | "registry-hardening"
  | "review-hardening"
  | "safe-actions-hardening"
  | "search-hardening"
  | "status-hardening"
  | "stress-validation-hardening"
  | "ticket-assignment-hardening"
  | "ticket-conversation-hardening"
  | "ticket-details-hardening"
  | "ticket-status-hardening"
  | "tickets-hardening"
  | "visibility-hardening";

export type SupportProductionHardeningStatus = "blocked" | "hardened" | "review_required" | "warning";

export type SupportProductionHardeningLoadingState =
  | "empty"
  | "error"
  | "hardened"
  | "restricted"
  | "unauthorized";

export type SupportProductionHardeningSafeControlKey =
  | "apply_hardening"
  | "export_hardening_report"
  | "mark_hardened"
  | "recheck_hardening"
  | "resolve_hardening_blocker";

export type SupportProductionHardeningSafeControl = {
  enabled: false;
  key: SupportProductionHardeningSafeControlKey;
  label: string;
  note: string;
};

export type SupportProductionHardeningItem = {
  blockedModules: number;
  certifiedSystemIsolationStatus: SupportProductionHardeningStatus;
  controlSafetyStatus: SupportProductionHardeningStatus;
  emptyStateStatus: SupportProductionHardeningStatus;
  executionIsolationStatus: SupportProductionHardeningStatus;
  groupKey: SupportProductionHardeningGroupKey;
  hardeningKey: string;
  hardeningName: string;
  hardeningScope: string;
  mutationIsolationStatus: SupportProductionHardeningStatus;
  readOnlyHardeningStatus: SupportProductionHardeningStatus;
  safeControls: SupportProductionHardeningSafeControl[];
  safeSummary: string;
  secretMaskingStatus: SupportProductionHardeningStatus;
  warningModules: number;
};

export type SupportProductionHardeningGroup = {
  groupKey: SupportProductionHardeningGroupKey;
  itemCount: number;
  items: SupportProductionHardeningItem[];
  title: string;
};

export type SupportProductionHardeningSummary = {
  blockedScopes: number;
  emptyMessage: string | null;
  groupCount: number;
  hardenedScopes: number;
  loadError: string | null;
  loadingState: SupportProductionHardeningLoadingState;
  overallStatus: "needs_attention" | "support_production_hardening_ready";
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  reviewRequiredScopes: number;
  source: SupportProductionHardeningSource;
  summary: string;
  totalHardeningScopes: number;
  unauthorizedMessage: string | null;
  warningScopes: number;
};

export type SupportProductionHardeningRuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

type SafeControlSnapshot = {
  enabled: boolean;
};

export type SupportProductionHardeningAuthorization = {
  canViewProductionHardening: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportProductionHardeningInput = {
  analyticsRuntime: SupportProductionHardeningRuntimeSnapshot;
  analyticsSafeControls: SafeControlSnapshot[];
  auditRuntime: SupportProductionHardeningRuntimeSnapshot;
  auditSafeControls: SafeControlSnapshot[];
  authorization: SupportProductionHardeningAuthorization;
  dashboardRuntime: SupportProductionHardeningRuntimeSnapshot;
  dataCertification: SupportDataCertificationSummary;
  dataCertificationSafeControls: SafeControlSnapshot[];
  errorEventsRuntime: SupportProductionHardeningRuntimeSnapshot;
  errorEventsSafeControls: SafeControlSnapshot[];
  eventTimelineRuntime: SupportProductionHardeningRuntimeSnapshot;
  eventTimelineSafeControls: SafeControlSnapshot[];
  exportRuntime: SupportProductionHardeningRuntimeSnapshot;
  filtersRuntime: SupportProductionHardeningRuntimeSnapshot;
  hiddenRecordCount?: number;
  loadError?: string | null;
  metricsRuntime: SupportProductionHardeningRuntimeSnapshot;
  monitoringEventsRuntime: SupportProductionHardeningRuntimeSnapshot;
  monitoringEventsSafeControls: SafeControlSnapshot[];
  notificationsRuntime: SupportProductionHardeningRuntimeSnapshot;
  notificationsSafeControls: SafeControlSnapshot[];
  productionCertification: SupportProductionCertificationSummary;
  productionCertificationItems: SupportProductionCertificationItem[];
  productionCertificationSafeControls: SafeControlSnapshot[];
  registryRuntime: SupportProductionHardeningRuntimeSnapshot;
  restrictedRecordCount?: number;
  reviewItems: Array<Pick<SupportReviewRuntimeItem, "registryKey" | "reviewStatus" | "safeSummary">>;
  reviewRuntime: SupportProductionHardeningRuntimeSnapshot;
  reviewSafeControls: SafeControlSnapshot[];
  role: "internal_team" | "super_admin";
  runtimeCertification: SupportRuntimeCertificationSummary;
  runtimeCertificationSafeControls: SafeControlSnapshot[];
  safeActionsRuntime: SupportProductionHardeningRuntimeSnapshot;
  searchRuntime: SupportProductionHardeningRuntimeSnapshot;
  securityCertification: SupportSecurityCertificationSummary;
  securityCertificationItems: SupportSecurityCertificationItem[];
  securityCertificationSafeControls: SafeControlSnapshot[];
  statusRuntime: SupportProductionHardeningRuntimeSnapshot;
  stressValidation: SupportStressValidationSummary;
  stressValidationItems: SupportStressValidationItem[];
  stressValidationSafeControls: SafeControlSnapshot[];
  ticketAssignmentRuntime: SupportProductionHardeningRuntimeSnapshot;
  ticketConversationRuntime: SupportProductionHardeningRuntimeSnapshot;
  ticketDetailsRuntime: SupportProductionHardeningRuntimeSnapshot;
  ticketStatusRuntime: SupportProductionHardeningRuntimeSnapshot;
  ticketsRuntime: SupportProductionHardeningRuntimeSnapshot;
  ticketsSafeControls: SafeControlSnapshot[];
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibilityRuntime: SupportProductionHardeningRuntimeSnapshot;
};

type HardeningScopeDefinition = {
  expectedSources: readonly string[];
  groupKey: SupportProductionHardeningGroupKey;
  hardeningGuarantee: string;
  hardeningName: string;
  hardeningScope: string;
  registryKeys: readonly string[];
  resolveRuntimeSnapshots: (input: SupportProductionHardeningInput) => SupportProductionHardeningRuntimeSnapshot[];
  resolveSafeControls: (input: SupportProductionHardeningInput) => SafeControlSnapshot[];
  securityCertificationKey: string | null;
  stressValidationKey: string | null;
};

export const SUPPORT_PRODUCTION_HARDENING_SOURCE = "support_production_hardening_runtime" as const;

export const SUPPORT_PRODUCTION_HARDENING_SAFE_CONTROLS: readonly SupportProductionHardeningSafeControl[] = [
  {
    enabled: false,
    key: "apply_hardening",
    label: "Apply Hardening",
    note: "Read-only placeholder. No hardening apply or mutation runs during SP-27 page load."
  },
  {
    enabled: false,
    key: "recheck_hardening",
    label: "Recheck Hardening",
    note: "Read-only placeholder. No hardening recheck execution or mutation runs during SP-27 page load."
  },
  {
    enabled: false,
    key: "export_hardening_report",
    label: "Export Hardening Report",
    note: "Read-only placeholder. No hardening export runs during SP-27 page load."
  },
  {
    enabled: false,
    key: "resolve_hardening_blocker",
    label: "Resolve Hardening Blocker",
    note: "Read-only placeholder. No hardening blocker resolve action runs during SP-27 page load."
  },
  {
    enabled: false,
    key: "mark_hardened",
    label: "Mark Hardened",
    note: "Read-only placeholder. No hardening record write runs during SP-27 page load."
  }
] as const;

const HARDENING_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportProductionHardeningGroupKey;
  title: string;
}> = [
  { groupKey: "registry-hardening", title: "Registry Hardening" },
  { groupKey: "dashboard-hardening", title: "Dashboard Hardening" },
  { groupKey: "tickets-hardening", title: "Tickets Hardening" },
  { groupKey: "ticket-details-hardening", title: "Ticket Details Hardening" },
  { groupKey: "ticket-status-hardening", title: "Ticket Status Hardening" },
  { groupKey: "ticket-assignment-hardening", title: "Ticket Assignment Hardening" },
  { groupKey: "ticket-conversation-hardening", title: "Ticket Conversation Hardening" },
  { groupKey: "monitoring-events-hardening", title: "Monitoring Events Hardening" },
  { groupKey: "error-events-hardening", title: "Error Events Hardening" },
  { groupKey: "event-timeline-hardening", title: "Event Timeline Hardening" },
  { groupKey: "search-hardening", title: "Search Hardening" },
  { groupKey: "filters-hardening", title: "Filters Hardening" },
  { groupKey: "metrics-hardening", title: "Metrics Hardening" },
  { groupKey: "visibility-hardening", title: "Visibility Hardening" },
  { groupKey: "safe-actions-hardening", title: "Safe Actions Hardening" },
  { groupKey: "audit-hardening", title: "Audit Hardening" },
  { groupKey: "review-hardening", title: "Review Hardening" },
  { groupKey: "notifications-hardening", title: "Notifications Hardening" },
  { groupKey: "analytics-hardening", title: "Analytics Hardening" },
  { groupKey: "export-hardening", title: "Export Hardening" },
  { groupKey: "status-hardening", title: "Status Hardening" },
  { groupKey: "certification-hardening", title: "Certification Hardening" },
  { groupKey: "stress-validation-hardening", title: "Stress Validation Hardening" }
];

const HARDENING_SCOPE_DEFINITIONS: readonly HardeningScopeDefinition[] = [
  {
    expectedSources: [SUPPORT_REGISTRY_SOURCE],
    groupKey: "registry-hardening",
    hardeningGuarantee: "read-only registry metadata with masked secrets",
    hardeningName: "Registry Hardening",
    hardeningScope: "SP-1 registry read-only hardening and deterministic output",
    registryKeys: [],
    resolveRuntimeSnapshots: (input) => [input.registryRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-registry-data",
    stressValidationKey: "sp-stress-registry-stress-validation"
  },
  {
    expectedSources: ["support_dashboard_runtime"],
    groupKey: "dashboard-hardening",
    hardeningGuarantee: "derived dashboard with safe fallbacks and no duplicate fetches",
    hardeningName: "Dashboard Hardening",
    hardeningScope: "SP-2 dashboard read-only hardening and stable rendering",
    registryKeys: ["sp-dashboard"],
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-dashboard-data",
    stressValidationKey: "sp-stress-dashboard-stress-validation"
  },
  {
    expectedSources: ["support_tickets_runtime"],
    groupKey: "tickets-hardening",
    hardeningGuarantee: "read-only tickets metadata with disabled controls",
    hardeningName: "Tickets Hardening",
    hardeningScope: "SP-3 tickets read-only hardening under large datasets",
    registryKeys: ["sp-tickets"],
    resolveRuntimeSnapshots: (input) => [input.ticketsRuntime],
    resolveSafeControls: (input) => input.ticketsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-tickets-data",
    stressValidationKey: "sp-stress-tickets-stress-validation"
  },
  {
    expectedSources: ["support_ticket_details_runtime"],
    groupKey: "ticket-details-hardening",
    hardeningGuarantee: "safe fallbacks for invalid ticket identifiers",
    hardeningName: "Ticket Details Hardening",
    hardeningScope: "SP-4 ticket details read-only hardening with safe error boundaries",
    registryKeys: ["sp-ticket-details"],
    resolveRuntimeSnapshots: (input) => [input.ticketDetailsRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-details-data",
    stressValidationKey: "sp-stress-ticket-details-stress-validation"
  },
  {
    expectedSources: ["support_ticket_status_runtime"],
    groupKey: "ticket-status-hardening",
    hardeningGuarantee: "explicit Super Admin authorization without page load mutation",
    hardeningName: "Ticket Status Hardening",
    hardeningScope: "SP-5 ticket status read-only hardening with unauthorized safe fallback",
    registryKeys: ["sp-ticket-status"],
    resolveRuntimeSnapshots: (input) => [input.ticketStatusRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-status-data",
    stressValidationKey: "sp-stress-ticket-status-stress-validation"
  },
  {
    expectedSources: ["support_ticket_assignment_runtime"],
    groupKey: "ticket-assignment-hardening",
    hardeningGuarantee: "read-only assignment metadata without client mutation",
    hardeningName: "Ticket Assignment Hardening",
    hardeningScope: "SP-6 ticket assignment read-only hardening without execution",
    registryKeys: ["sp-ticket-assignment"],
    resolveRuntimeSnapshots: (input) => [input.ticketAssignmentRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-assignment-data",
    stressValidationKey: "sp-stress-ticket-assignment-stress-validation"
  },
  {
    expectedSources: ["support_ticket_conversation_runtime"],
    groupKey: "ticket-conversation-hardening",
    hardeningGuarantee: "large conversation threads stable without re-render loops",
    hardeningName: "Ticket Conversation Hardening",
    hardeningScope: "SP-7 ticket conversation read-only hardening for large datasets",
    registryKeys: ["sp-ticket-conversation"],
    resolveRuntimeSnapshots: (input) => [input.ticketConversationRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-conversation-data",
    stressValidationKey: "sp-stress-ticket-conversation-stress-validation"
  },
  {
    expectedSources: ["support_monitoring_events_runtime"],
    groupKey: "monitoring-events-hardening",
    hardeningGuarantee: "read-only monitoring metadata without raw payloads",
    hardeningName: "Monitoring Events Hardening",
    hardeningScope: "SP-8 monitoring events read-only hardening with secret masking",
    registryKeys: ["sp-monitoring-events"],
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime],
    resolveSafeControls: (input) => input.monitoringEventsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-monitoring-events-data",
    stressValidationKey: "sp-stress-monitoring-events-stress-validation"
  },
  {
    expectedSources: ["support_error_events_runtime"],
    groupKey: "error-events-hardening",
    hardeningGuarantee: "sanitized error metadata without stack traces",
    hardeningName: "Error Events Hardening",
    hardeningScope: "SP-9 error events read-only hardening with safe latency fallbacks",
    registryKeys: ["sp-error-events"],
    resolveRuntimeSnapshots: (input) => [input.errorEventsRuntime],
    resolveSafeControls: (input) => input.errorEventsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-error-events-data",
    stressValidationKey: "sp-stress-error-events-stress-validation"
  },
  {
    expectedSources: ["support_event_timeline_runtime"],
    groupKey: "event-timeline-hardening",
    hardeningGuarantee: "large timeline stable without excessive queries",
    hardeningName: "Event Timeline Hardening",
    hardeningScope: "SP-10 event timeline read-only hardening for large datasets",
    registryKeys: ["sp-event-timeline"],
    resolveRuntimeSnapshots: (input) => [input.eventTimelineRuntime],
    resolveSafeControls: (input) => input.eventTimelineSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-event-timeline-data",
    stressValidationKey: "sp-stress-event-timeline-stress-validation"
  },
  {
    expectedSources: ["support_search_runtime"],
    groupKey: "search-hardening",
    hardeningGuarantee: "controlled search without duplicate fetch loops",
    hardeningName: "Search Hardening",
    hardeningScope: "SP-11 search read-only hardening with combined filters stability",
    registryKeys: ["sp-search"],
    resolveRuntimeSnapshots: (input) => [input.searchRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-search-data",
    stressValidationKey: "sp-stress-search-stress-validation"
  },
  {
    expectedSources: ["support_filters_runtime"],
    groupKey: "filters-hardening",
    hardeningGuarantee: "controlled filters without unnecessary re-renders",
    hardeningName: "Filters Hardening",
    hardeningScope: "SP-12 filters read-only hardening with combined search stability",
    registryKeys: ["sp-filters"],
    resolveRuntimeSnapshots: (input) => [input.filtersRuntime, input.searchRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-filters-data",
    stressValidationKey: "sp-stress-filters-stress-validation"
  },
  {
    expectedSources: ["support_metrics_runtime"],
    groupKey: "metrics-hardening",
    hardeningGuarantee: "derived metrics without excessive queries",
    hardeningName: "Metrics Hardening",
    hardeningScope: "SP-13 metrics read-only hardening with safe empty states",
    registryKeys: ["sp-metrics"],
    resolveRuntimeSnapshots: (input) => [input.metricsRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-metrics-data",
    stressValidationKey: "sp-stress-metrics-stress-validation"
  },
  {
    expectedSources: ["support_visibility_runtime"],
    groupKey: "visibility-hardening",
    hardeningGuarantee: "derived visibility without RLS bypass or client mutation",
    hardeningName: "Visibility Hardening",
    hardeningScope: "SP-14 visibility read-only hardening with restricted safe fallback",
    registryKeys: ["sp-visibility"],
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-visibility-data",
    stressValidationKey: "sp-stress-visibility-stress-validation"
  },
  {
    expectedSources: ["support_safe_actions_runtime"],
    groupKey: "safe-actions-hardening",
    hardeningGuarantee: "explicit Super Admin actions only without page load execution",
    hardeningName: "Safe Actions Hardening",
    hardeningScope: "SP-15 safe actions read-only hardening with disabled page load execution",
    registryKeys: ["sp-safe-actions"],
    resolveRuntimeSnapshots: (input) => [input.safeActionsRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-safe-actions-data",
    stressValidationKey: "sp-stress-safe-actions-stress-validation"
  },
  {
    expectedSources: ["support_audit_runtime"],
    groupKey: "audit-hardening",
    hardeningGuarantee: "read-only audit metadata without raw payloads",
    hardeningName: "Audit Hardening",
    hardeningScope: "SP-16 audit read-only hardening with sanitized summaries",
    registryKeys: ["sp-audit"],
    resolveRuntimeSnapshots: (input) => [input.auditRuntime],
    resolveSafeControls: (input) => input.auditSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-audit-data",
    stressValidationKey: "sp-stress-audit-stress-validation"
  },
  {
    expectedSources: ["support_review_runtime"],
    groupKey: "review-hardening",
    hardeningGuarantee: "derived review metadata without mutation hooks",
    hardeningName: "Review Hardening",
    hardeningScope: "SP-17 review read-only hardening with derived-only output",
    registryKeys: ["sp-review"],
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime],
    resolveSafeControls: (input) => input.reviewSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-review-data",
    stressValidationKey: "sp-stress-review-stress-validation"
  },
  {
    expectedSources: ["support_notifications_runtime"],
    groupKey: "notifications-hardening",
    hardeningGuarantee: "read-only notifications without duplicate requests",
    hardeningName: "Notifications Hardening",
    hardeningScope: "SP-18 notifications read-only hardening with disabled controls",
    registryKeys: ["sp-notifications"],
    resolveRuntimeSnapshots: (input) => [input.notificationsRuntime],
    resolveSafeControls: (input) => input.notificationsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-notifications-data",
    stressValidationKey: "sp-stress-notifications-stress-validation"
  },
  {
    expectedSources: ["support_analytics_runtime"],
    groupKey: "analytics-hardening",
    hardeningGuarantee: "derived analytics without excessive re-renders",
    hardeningName: "Analytics Hardening",
    hardeningScope: "SP-19 analytics read-only hardening with safe empty states",
    registryKeys: ["sp-analytics"],
    resolveRuntimeSnapshots: (input) => [input.analyticsRuntime],
    resolveSafeControls: (input) => input.analyticsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-analytics-data",
    stressValidationKey: "sp-stress-analytics-stress-validation"
  },
  {
    expectedSources: ["support_export_runtime"],
    groupKey: "export-hardening",
    hardeningGuarantee: "explicit download only without page load export execution",
    hardeningName: "Export Hardening",
    hardeningScope: "SP-20 export read-only hardening with sanitized fields",
    registryKeys: ["sp-export"],
    resolveRuntimeSnapshots: (input) => [input.exportRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-export-data",
    stressValidationKey: "sp-stress-export-stress-validation"
  },
  {
    expectedSources: ["support_status_runtime"],
    groupKey: "status-hardening",
    hardeningGuarantee: "derived status metadata without mutation hooks",
    hardeningName: "Support Status Hardening",
    hardeningScope: "SP-21 support status read-only hardening with safe runtime states",
    registryKeys: ["sp-status"],
    resolveRuntimeSnapshots: (input) => [input.statusRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-status-data",
    stressValidationKey: "sp-stress-status-stress-validation"
  },
  {
    expectedSources: [
      "support_data_certification_runtime",
      "support_security_certification_runtime",
      "support_runtime_certification_runtime",
      "support_production_certification_runtime"
    ],
    groupKey: "certification-hardening",
    hardeningGuarantee: "certification metadata read-only without persistence",
    hardeningName: "Certification Hardening",
    hardeningScope: "SP-22 through SP-25 certification read-only hardening and isolation",
    registryKeys: ["sp-data-certification", "sp-security-certification", "sp-runtime-certification", "sp-production-certification"],
    resolveRuntimeSnapshots: (input) => [
      input.dataCertification,
      input.securityCertification,
      input.runtimeCertification,
      input.productionCertification
    ],
    resolveSafeControls: (input) => [
      ...input.dataCertificationSafeControls,
      ...input.securityCertificationSafeControls,
      ...input.runtimeCertificationSafeControls,
      ...input.productionCertificationSafeControls
    ],
    securityCertificationKey: "sp-sec-data-certification-security-review",
    stressValidationKey: "sp-stress-certification-stress-validation"
  },
  {
    expectedSources: ["support_stress_validation_runtime"],
    groupKey: "stress-validation-hardening",
    hardeningGuarantee: "stress validation metadata read-only without load testing",
    hardeningName: "Stress Validation Hardening",
    hardeningScope: "SP-26 stress validation read-only hardening and certified system isolation",
    registryKeys: ["sp-stress-validation"],
    resolveRuntimeSnapshots: (input) => [input.stressValidation],
    resolveSafeControls: (input) => input.stressValidationSafeControls,
    securityCertificationKey: null,
    stressValidationKey: null
  }
] as const;

function buildSafeControls() {
  return SUPPORT_PRODUCTION_HARDENING_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectRegistryCounts(input: SupportProductionHardeningInput, registryKeys: readonly string[]) {
  const reviewItems = input.reviewItems.filter((item) => registryKeys.includes(item.registryKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function validateRuntimeShape(
  snapshots: SupportProductionHardeningRuntimeSnapshot[],
  expectedSources: readonly string[]
) {
  if (!snapshots.length) {
    return false;
  }

  return snapshots.every(
    (snapshot) =>
      snapshot.readOnly === true &&
      Boolean(snapshot.source) &&
      expectedSources.includes(String(snapshot.source)) &&
      typeof snapshot.summary === "string" &&
      snapshot.summary.trim().length > 0
  );
}

function validateSafeControlsDisabled(controls: SafeControlSnapshot[]) {
  if (!controls.length) {
    return true;
  }

  return controls.every((control) => control.enabled === false);
}

function validateCertifiedSystemIsolation(snapshots: SupportProductionHardeningRuntimeSnapshot[]) {
  return snapshots.every((snapshot) => String(snapshot.source).startsWith("support_"));
}

function mapStressStatusToHardeningStatus(
  status: SupportStressValidationItem["refreshStabilityStatus"] | undefined
): SupportProductionHardeningStatus {
  switch (status) {
    case "stable":
      return "hardened";
    case "warning":
      return "warning";
    case "blocked":
      return "blocked";
    case "review_required":
    default:
      return "review_required";
  }
}

function mapSecretMaskingStatus(item: SupportSecurityCertificationItem | null): SupportProductionHardeningStatus {
  if (!item) {
    return "review_required";
  }

  if (item.secretSafetyStatus === "certified" && item.privateDataSafetyStatus === "certified") {
    return "hardened";
  }

  return "review_required";
}

function mapControlSafetyStatus(input: {
  safeControlsDisabled: boolean;
  securityCertificationItem: SupportSecurityCertificationItem | null;
}): SupportProductionHardeningStatus {
  if (!input.safeControlsDisabled) {
    return "blocked";
  }

  if (input.securityCertificationItem?.actionSafetyStatus === "certified") {
    return "hardened";
  }

  return input.safeControlsDisabled ? "hardened" : "review_required";
}

function buildHardeningItem(
  definition: HardeningScopeDefinition,
  input: SupportProductionHardeningInput
): SupportProductionHardeningItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const safeControls = definition.resolveSafeControls(input);
  const stressItem = definition.stressValidationKey
    ? input.stressValidationItems.find((item) => item.stressValidationKey === definition.stressValidationKey) ?? null
    : null;
  const securityCertificationItem = definition.securityCertificationKey
    ? input.securityCertificationItems.find(
        (item) => item.securityCertificationKey === definition.securityCertificationKey
      ) ?? null
    : null;
  const moduleCounts =
    definition.groupKey === "certification-hardening"
      ? {
          blockedModules: input.productionCertification.blockedScopes,
          warningModules: input.productionCertification.warningScopes
        }
      : definition.groupKey === "stress-validation-hardening"
        ? {
            blockedModules: input.stressValidation.blockedScopes,
            warningModules: input.stressValidation.warningScopes
          }
        : collectRegistryCounts(input, definition.registryKeys);
  const readOnlyHardeningStatus: SupportProductionHardeningStatus = runtimeShapeValid
    ? stressItem
      ? mapStressStatusToHardeningStatus(stressItem.refreshStabilityStatus)
      : definition.groupKey === "stress-validation-hardening"
        ? input.stressValidation.overallStatus === "support_stress_validation_ready"
          ? "hardened"
          : "review_required"
        : "hardened"
    : "review_required";
  const controlSafetyStatus = mapControlSafetyStatus({
    safeControlsDisabled: validateSafeControlsDisabled(safeControls),
    securityCertificationItem
  });
  const secretMaskingStatus =
    definition.groupKey === "stress-validation-hardening"
      ? input.stressValidationItems.every((item) => item.secretSafetyStatus === "stable")
        ? "hardened"
        : "review_required"
      : mapSecretMaskingStatus(securityCertificationItem);
  const emptyStateStatus = stressItem
    ? mapStressStatusToHardeningStatus(stressItem.emptyStateSafetyStatus)
    : definition.groupKey === "stress-validation-hardening"
      ? input.stressValidationItems.every((item) => isSupportStressScopeStable(item))
        ? "hardened"
        : "review_required"
      : runtimeShapeValid && moduleCounts.blockedModules === 0
        ? moduleCounts.warningModules > 0
          ? "warning"
          : "hardened"
        : moduleCounts.blockedModules > 0
          ? "blocked"
          : "review_required";
  const executionIsolationStatus = stressItem
    ? mapStressStatusToHardeningStatus(stressItem.executionSafetyStatus)
    : runtimeShapeValid
      ? "hardened"
      : "review_required";
  const mutationIsolationStatus = stressItem
    ? mapStressStatusToHardeningStatus(stressItem.mutationSafetyStatus)
    : runtimeShapeValid
      ? "hardened"
      : "review_required";
  const certifiedSystemIsolationStatus: SupportProductionHardeningStatus =
    runtimeShapeValid && validateCertifiedSystemIsolation(snapshots)
      ? stressItem
        ? mapStressStatusToHardeningStatus(stressItem.certifiedSystemIsolationStatus)
        : "hardened"
      : "blocked";

  return {
    blockedModules: moduleCounts.blockedModules,
    certifiedSystemIsolationStatus,
    controlSafetyStatus,
    emptyStateStatus,
    executionIsolationStatus,
    groupKey: definition.groupKey,
    hardeningKey: `sp-hardening-${definition.groupKey}`,
    hardeningName: definition.hardeningName,
    hardeningScope: definition.hardeningScope,
    mutationIsolationStatus,
    readOnlyHardeningStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `guarantee ${definition.hardeningGuarantee}`,
      `read only ${readOnlyHardeningStatus}`,
      `controls ${controlSafetyStatus}`,
      `secrets ${secretMaskingStatus}`,
      `empty state ${emptyStateStatus}`,
      `execution ${executionIsolationStatus}`,
      `mutation ${mutationIsolationStatus}`,
      `isolation ${certifiedSystemIsolationStatus}`,
      `${moduleCounts.blockedModules} blocked`,
      `${moduleCounts.warningModules} warning`
    ].join("; "),
    secretMaskingStatus,
    warningModules: moduleCounts.warningModules
  };
}

export function resolveSupportProductionHardeningAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportProductionHardeningAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewProductionHardening: true,
      reason: "Super Admin may view Support production hardening through read-only runtime metadata.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewProductionHardening: false,
    reason: "Support production hardening is restricted to Super Admin in SP-27.",
    roleLabel: input.role
  };
}

export function isSupportHardeningScopeReady(item: SupportProductionHardeningItem) {
  return (
    item.readOnlyHardeningStatus === "hardened" &&
    item.controlSafetyStatus === "hardened" &&
    item.secretMaskingStatus === "hardened" &&
    item.emptyStateStatus === "hardened" &&
    item.executionIsolationStatus === "hardened" &&
    item.mutationIsolationStatus === "hardened" &&
    item.certifiedSystemIsolationStatus === "hardened"
  );
}

export function buildSupportProductionHardeningGroups(
  items: SupportProductionHardeningItem[]
): SupportProductionHardeningGroup[] {
  return HARDENING_GROUP_DEFINITIONS.map((definition) => {
    const groupItems = items.filter((item) => item.groupKey === definition.groupKey);

    return {
      groupKey: definition.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: definition.title
    };
  }).filter((group) => group.itemCount > 0);
}

function getSupportProductionHardeningSummary(
  items: SupportProductionHardeningItem[],
  input: Pick<
    SupportProductionHardeningInput,
    "authorization" | "hiddenRecordCount" | "loadError" | "restrictedRecordCount" | "role" | "visibilityAuthorization"
  >
): SupportProductionHardeningSummary {
  const registryEntry = getSupportRegistryEntry("sp-production-hardening");
  const hiddenRecordCount = input.hiddenRecordCount ?? 0;
  const restrictedRecordCount = input.restrictedRecordCount ?? 0;

  if (
    !input.authorization.canViewProductionHardening ||
    !input.visibilityAuthorization.canViewSupportData ||
    input.role !== "super_admin"
  ) {
    return {
      blockedScopes: 0,
      emptyMessage: "Support production hardening is hidden for the current account.",
      groupCount: 0,
      hardenedScopes: 0,
      loadError: null,
      loadingState: "unauthorized",
      overallStatus: "needs_attention",
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: HARDENING_SCOPE_DEFINITIONS.length,
      source: SUPPORT_PRODUCTION_HARDENING_SOURCE,
      summary: input.authorization.reason,
      totalHardeningScopes: HARDENING_SCOPE_DEFINITIONS.length,
      unauthorizedMessage:
        "Support production hardening is Super Admin only. No hardening mutation runs during page load.",
      warningScopes: 0
    };
  }

  if (input.loadError) {
    return {
      blockedScopes: items.length,
      emptyMessage: null,
      groupCount: 0,
      hardenedScopes: 0,
      loadError: input.loadError,
      loadingState: "error",
      overallStatus: "needs_attention",
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: items.length,
      source: SUPPORT_PRODUCTION_HARDENING_SOURCE,
      summary: `status load_error; ${input.loadError}`,
      totalHardeningScopes: items.length,
      unauthorizedMessage: null,
      warningScopes: 0
    };
  }

  const hardenedScopes = items.filter((item) => isSupportHardeningScopeReady(item)).length;
  const blockedScopes = items.filter(
    (item) =>
      item.readOnlyHardeningStatus === "blocked" ||
      item.controlSafetyStatus === "blocked" ||
      item.secretMaskingStatus === "blocked" ||
      item.emptyStateStatus === "blocked" ||
      item.executionIsolationStatus === "blocked" ||
      item.mutationIsolationStatus === "blocked" ||
      item.certifiedSystemIsolationStatus === "blocked"
  ).length;
  const warningScopes = items.filter(
    (item) =>
      item.readOnlyHardeningStatus === "warning" ||
      item.controlSafetyStatus === "warning" ||
      item.emptyStateStatus === "warning" ||
      item.executionIsolationStatus === "warning" ||
      item.mutationIsolationStatus === "warning" ||
      item.certifiedSystemIsolationStatus === "warning"
  ).length;
  const reviewRequiredScopes = items.length - hardenedScopes - blockedScopes;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("support_production_hardening_ready" as const);
  const loadingState: SupportProductionHardeningLoadingState =
    restrictedRecordCount > 0
      ? "restricted"
      : hardenedScopes === 0
        ? "empty"
        : overallStatus === "support_production_hardening_ready"
          ? "hardened"
          : "restricted";

  return {
    blockedScopes,
    emptyMessage:
      hardenedScopes === 0 ? "No Support production hardening scopes are ready for the current runtime snapshot." : null,
    groupCount: buildSupportProductionHardeningGroups(items).length,
    hardenedScopes,
    loadError: null,
    loadingState,
    overallStatus,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      restrictedRecordCount > 0
        ? `${restrictedRecordCount} record(s) excluded from Support production hardening under SP-14 visibility rules.`
        : null,
    reviewRequiredScopes: Math.max(reviewRequiredScopes, 0),
    source: SUPPORT_PRODUCTION_HARDENING_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} hardening scopes`,
      `${hardenedScopes} hardened`,
      `${Math.max(reviewRequiredScopes, 0)} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`,
      `${hiddenRecordCount} hidden`,
      registryEntry?.productionReady ? "registry production_ready" : "registry pending"
    ].join("; "),
    totalHardeningScopes: items.length,
    unauthorizedMessage: null,
    warningScopes
  };
}

export function supportProductionHardeningStatusLabel(status: SupportProductionHardeningStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "hardened":
      return "Hardened";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function supportProductionHardeningStatusTone(status: SupportProductionHardeningStatus) {
  switch (status) {
    case "hardened":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function supportProductionHardeningRuntimeStatusBadgeTone(
  status: SupportProductionHardeningSummary["overallStatus"]
): "amber" | "green" {
  return status === "support_production_hardening_ready" ? "green" : "amber";
}

export function buildSupportProductionHardeningReadOnlySafe(input: SupportProductionHardeningInput) {
  const productionHardeningItems = HARDENING_SCOPE_DEFINITIONS.map((definition) =>
    buildHardeningItem(definition, input)
  );
  const groups = buildSupportProductionHardeningGroups(productionHardeningItems);
  const productionHardening = getSupportProductionHardeningSummary(productionHardeningItems, input);

  return {
    productionHardening,
    productionHardeningGroups: groups,
    productionHardeningItems,
    productionHardeningSafeControls: buildSafeControls()
  };
}

export function mapSupportProductionHardeningToAdminFields(
  input: ReturnType<typeof buildSupportProductionHardeningReadOnlySafe>
) {
  return input;
}

export function toSupportProductionHardeningSnapshot(input: {
  readOnly?: boolean;
  source?: string;
  summary?: string;
}): SupportProductionHardeningRuntimeSnapshot {
  return {
    readOnly: input.readOnly ?? true,
    source: input.source,
    summary: input.summary
  };
}
