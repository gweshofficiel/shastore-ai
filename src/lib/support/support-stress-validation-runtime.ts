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
import type {
  SupportRuntimeCertificationSummary
} from "@/src/lib/support/support-runtime-certification-runtime";
import type {
  SupportSecurityCertificationItem,
  SupportSecurityCertificationSummary
} from "@/src/lib/support/support-security-certification-runtime";
import type { SupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";

export type SupportStressValidationSource = "support_stress_validation_runtime";

export type SupportStressValidationGroupKey =
  | "analytics-stress-validation"
  | "audit-stress-validation"
  | "certification-stress-validation"
  | "dashboard-stress-validation"
  | "error-events-stress-validation"
  | "event-timeline-stress-validation"
  | "export-stress-validation"
  | "filters-stress-validation"
  | "metrics-stress-validation"
  | "monitoring-events-stress-validation"
  | "notifications-stress-validation"
  | "registry-stress-validation"
  | "review-stress-validation"
  | "safe-actions-stress-validation"
  | "search-stress-validation"
  | "status-stress-validation"
  | "ticket-assignment-stress-validation"
  | "ticket-conversation-stress-validation"
  | "ticket-details-stress-validation"
  | "ticket-status-stress-validation"
  | "tickets-stress-validation"
  | "visibility-stress-validation";

export type SupportStressValidationStatus = "blocked" | "review_required" | "stable" | "warning";

export type SupportStressValidationLoadingState =
  | "empty"
  | "error"
  | "restricted"
  | "stable"
  | "unauthorized";

export type SupportStressValidationSafeControlKey =
  | "export_stress_report"
  | "mark_stress_validated"
  | "recheck_stability"
  | "resolve_stress_blocker"
  | "run_stress_test";

export type SupportStressValidationSafeControl = {
  enabled: false;
  key: SupportStressValidationSafeControlKey;
  label: string;
  note: string;
};

export type SupportStressValidationItem = {
  blockedModules: number;
  certifiedSystemIsolationStatus: SupportStressValidationStatus;
  disabledControlsStatus: SupportStressValidationStatus;
  emptyStateSafetyStatus: SupportStressValidationStatus;
  executionSafetyStatus: SupportStressValidationStatus;
  groupKey: SupportStressValidationGroupKey;
  metadataConsistencyStatus: SupportStressValidationStatus;
  mutationSafetyStatus: SupportStressValidationStatus;
  refreshStabilityStatus: SupportStressValidationStatus;
  safeControls: SupportStressValidationSafeControl[];
  safeSummary: string;
  secretSafetyStatus: SupportStressValidationStatus;
  stressValidationKey: string;
  validationName: string;
  validationScope: string;
  warningModules: number;
};

export type SupportStressValidationGroup = {
  groupKey: SupportStressValidationGroupKey;
  itemCount: number;
  items: SupportStressValidationItem[];
  title: string;
};

export type SupportStressValidationSummary = {
  blockedScopes: number;
  emptyMessage: string | null;
  groupCount: number;
  loadError: string | null;
  loadingState: SupportStressValidationLoadingState;
  overallStatus: "needs_attention" | "support_stress_validation_ready";
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  reviewRequiredScopes: number;
  source: SupportStressValidationSource;
  stableScopes: number;
  summary: string;
  totalValidations: number;
  unauthorizedMessage: string | null;
  warningScopes: number;
};

export type SupportStressValidationRuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

type SafeControlSnapshot = {
  enabled: boolean;
};

export type SupportStressValidationAuthorization = {
  canViewStressValidation: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportStressValidationInput = {
  analyticsRuntime: SupportStressValidationRuntimeSnapshot;
  analyticsSafeControls: SafeControlSnapshot[];
  auditRuntime: SupportStressValidationRuntimeSnapshot;
  auditSafeControls: SafeControlSnapshot[];
  authorization: SupportStressValidationAuthorization;
  dashboardRuntime: SupportStressValidationRuntimeSnapshot;
  dataCertification: SupportDataCertificationSummary;
  dataCertificationSafeControls: SafeControlSnapshot[];
  errorEventsRuntime: SupportStressValidationRuntimeSnapshot;
  errorEventsSafeControls: SafeControlSnapshot[];
  eventTimelineRuntime: SupportStressValidationRuntimeSnapshot;
  eventTimelineSafeControls: SafeControlSnapshot[];
  exportRuntime: SupportStressValidationRuntimeSnapshot;
  filtersRuntime: SupportStressValidationRuntimeSnapshot;
  hiddenRecordCount?: number;
  loadError?: string | null;
  metricsRuntime: SupportStressValidationRuntimeSnapshot;
  monitoringEventsRuntime: SupportStressValidationRuntimeSnapshot;
  monitoringEventsSafeControls: SafeControlSnapshot[];
  notificationsRuntime: SupportStressValidationRuntimeSnapshot;
  notificationsSafeControls: SafeControlSnapshot[];
  productionCertification: SupportProductionCertificationSummary;
  productionCertificationItems: SupportProductionCertificationItem[];
  productionCertificationSafeControls: SafeControlSnapshot[];
  registryRuntime: SupportStressValidationRuntimeSnapshot;
  restrictedRecordCount?: number;
  reviewItems: Array<Pick<SupportReviewRuntimeItem, "registryKey" | "reviewStatus" | "safeSummary">>;
  reviewRuntime: SupportStressValidationRuntimeSnapshot;
  reviewSafeControls: SafeControlSnapshot[];
  role: "internal_team" | "super_admin";
  runtimeCertification: SupportRuntimeCertificationSummary;
  runtimeCertificationSafeControls: SafeControlSnapshot[];
  safeActionsRuntime: SupportStressValidationRuntimeSnapshot;
  searchRuntime: SupportStressValidationRuntimeSnapshot;
  securityCertification: SupportSecurityCertificationSummary;
  securityCertificationItems: SupportSecurityCertificationItem[];
  securityCertificationSafeControls: SafeControlSnapshot[];
  statusRuntime: SupportStressValidationRuntimeSnapshot;
  ticketAssignmentRuntime: SupportStressValidationRuntimeSnapshot;
  ticketConversationRuntime: SupportStressValidationRuntimeSnapshot;
  ticketDetailsRuntime: SupportStressValidationRuntimeSnapshot;
  ticketStatusRuntime: SupportStressValidationRuntimeSnapshot;
  ticketsRuntime: SupportStressValidationRuntimeSnapshot;
  ticketsSafeControls: SafeControlSnapshot[];
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibilityRuntime: SupportStressValidationRuntimeSnapshot;
};

type StressScopeDefinition = {
  expectedSources: readonly string[];
  groupKey: SupportStressValidationGroupKey;
  productionCertificationKey: string | null;
  registryKeys: readonly string[];
  resolveRuntimeSnapshots: (input: SupportStressValidationInput) => SupportStressValidationRuntimeSnapshot[];
  resolveSafeControls: (input: SupportStressValidationInput) => SafeControlSnapshot[];
  securityCertificationKey: string | null;
  stressCondition: string;
  validationName: string;
  validationScope: string;
};

export const SUPPORT_STRESS_VALIDATION_SOURCE = "support_stress_validation_runtime" as const;

export const SUPPORT_STRESS_VALIDATION_SAFE_CONTROLS: readonly SupportStressValidationSafeControl[] = [
  {
    enabled: false,
    key: "run_stress_test",
    label: "Run Stress Test",
    note: "Read-only placeholder. No stress execution or mutation runs during SP-26 page load."
  },
  {
    enabled: false,
    key: "recheck_stability",
    label: "Recheck Stability",
    note: "Read-only placeholder. No stability recheck execution or mutation runs during SP-26 page load."
  },
  {
    enabled: false,
    key: "export_stress_report",
    label: "Export Stress Report",
    note: "Read-only placeholder. No stress export runs during SP-26 page load."
  },
  {
    enabled: false,
    key: "resolve_stress_blocker",
    label: "Resolve Stress Blocker",
    note: "Read-only placeholder. No stress blocker resolve action runs during SP-26 page load."
  },
  {
    enabled: false,
    key: "mark_stress_validated",
    label: "Mark Stress Validated",
    note: "Read-only placeholder. No stress validation record write runs during SP-26 page load."
  }
] as const;

const STRESS_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportStressValidationGroupKey;
  title: string;
}> = [
  { groupKey: "registry-stress-validation", title: "Registry Stress Validation" },
  { groupKey: "dashboard-stress-validation", title: "Dashboard Stress Validation" },
  { groupKey: "tickets-stress-validation", title: "Tickets Stress Validation" },
  { groupKey: "ticket-details-stress-validation", title: "Ticket Details Stress Validation" },
  { groupKey: "ticket-status-stress-validation", title: "Ticket Status Stress Validation" },
  { groupKey: "ticket-assignment-stress-validation", title: "Ticket Assignment Stress Validation" },
  { groupKey: "ticket-conversation-stress-validation", title: "Ticket Conversation Stress Validation" },
  { groupKey: "monitoring-events-stress-validation", title: "Monitoring Events Stress Validation" },
  { groupKey: "error-events-stress-validation", title: "Error Events Stress Validation" },
  { groupKey: "event-timeline-stress-validation", title: "Event Timeline Stress Validation" },
  { groupKey: "search-stress-validation", title: "Search Stress Validation" },
  { groupKey: "filters-stress-validation", title: "Filters Stress Validation" },
  { groupKey: "metrics-stress-validation", title: "Metrics Stress Validation" },
  { groupKey: "visibility-stress-validation", title: "Visibility Stress Validation" },
  { groupKey: "safe-actions-stress-validation", title: "Safe Actions Stress Validation" },
  { groupKey: "audit-stress-validation", title: "Audit Stress Validation" },
  { groupKey: "review-stress-validation", title: "Review Stress Validation" },
  { groupKey: "notifications-stress-validation", title: "Notifications Stress Validation" },
  { groupKey: "analytics-stress-validation", title: "Analytics Stress Validation" },
  { groupKey: "export-stress-validation", title: "Export Stress Validation" },
  { groupKey: "status-stress-validation", title: "Status Stress Validation" },
  { groupKey: "certification-stress-validation", title: "Certification Stress Validation" }
];

const STRESS_SCOPE_DEFINITIONS: readonly StressScopeDefinition[] = [
  {
    expectedSources: [SUPPORT_REGISTRY_SOURCE],
    groupKey: "registry-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-registry-data",
    registryKeys: [],
    resolveRuntimeSnapshots: (input) => [input.registryRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-registry-data",
    stressCondition: "deterministic registry output under concurrent read operations",
    validationName: "Registry Stress Validation",
    validationScope: "SP-1 registry refresh stability and metadata consistency under rapid navigation"
  },
  {
    expectedSources: ["support_dashboard_runtime"],
    groupKey: "dashboard-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-dashboard-data",
    registryKeys: ["sp-dashboard"],
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-dashboard-data",
    stressCondition: "dashboard derived output under rapid navigation and large datasets",
    validationName: "Dashboard Stress Validation",
    validationScope: "SP-2 dashboard refresh stability without duplicated requests or re-fetch loops"
  },
  {
    expectedSources: ["support_tickets_runtime"],
    groupKey: "tickets-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-tickets-data",
    registryKeys: ["sp-tickets"],
    resolveRuntimeSnapshots: (input) => [input.ticketsRuntime],
    resolveSafeControls: (input) => input.ticketsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-tickets-data",
    stressCondition: "large ticket dataset read stability",
    validationName: "Tickets Stress Validation",
    validationScope: "SP-3 tickets refresh stability with safe empty states and disabled controls"
  },
  {
    expectedSources: ["support_ticket_details_runtime"],
    groupKey: "ticket-details-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-ticket-details-data",
    registryKeys: ["sp-ticket-details"],
    resolveRuntimeSnapshots: (input) => [input.ticketDetailsRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-details-data",
    stressCondition: "invalid resource identifier safe fallback",
    validationName: "Ticket Details Stress Validation",
    validationScope: "SP-4 ticket details stability with invalid ticket identifiers and empty datasets"
  },
  {
    expectedSources: ["support_ticket_status_runtime"],
    groupKey: "ticket-status-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-ticket-status-data",
    registryKeys: ["sp-ticket-status"],
    resolveRuntimeSnapshots: (input) => [input.ticketStatusRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-status-data",
    stressCondition: "unauthorized access safe fallback without mutation",
    validationName: "Ticket Status Stress Validation",
    validationScope: "SP-5 ticket status stability under unauthorized access and invalid identifiers"
  },
  {
    expectedSources: ["support_ticket_assignment_runtime"],
    groupKey: "ticket-assignment-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-ticket-assignment-data",
    registryKeys: ["sp-ticket-assignment"],
    resolveRuntimeSnapshots: (input) => [input.ticketAssignmentRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-assignment-data",
    stressCondition: "concurrent read stability without duplicate assignment requests",
    validationName: "Ticket Assignment Stress Validation",
    validationScope: "SP-6 ticket assignment refresh stability with read-only page load"
  },
  {
    expectedSources: ["support_ticket_conversation_runtime"],
    groupKey: "ticket-conversation-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-ticket-conversation-data",
    registryKeys: ["sp-ticket-conversation"],
    resolveRuntimeSnapshots: (input) => [input.ticketConversationRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-conversation-data",
    stressCondition: "large ticket conversation thread read stability",
    validationName: "Ticket Conversation Stress Validation",
    validationScope: "SP-7 ticket conversation stability under large message datasets"
  },
  {
    expectedSources: ["support_monitoring_events_runtime"],
    groupKey: "monitoring-events-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-monitoring-events-data",
    registryKeys: ["sp-monitoring-events"],
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime],
    resolveSafeControls: (input) => input.monitoringEventsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-monitoring-events-data",
    stressCondition: "large monitoring event dataset read stability",
    validationName: "Monitoring Events Stress Validation",
    validationScope: "SP-8 monitoring events refresh stability with disabled controls"
  },
  {
    expectedSources: ["support_error_events_runtime"],
    groupKey: "error-events-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-error-events-data",
    registryKeys: ["sp-error-events"],
    resolveRuntimeSnapshots: (input) => [input.errorEventsRuntime],
    resolveSafeControls: (input) => input.errorEventsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-error-events-data",
    stressCondition: "network latency safe fallback without secret exposure",
    validationName: "Error Events Stress Validation",
    validationScope: "SP-9 error events stability under latency and empty datasets"
  },
  {
    expectedSources: ["support_event_timeline_runtime"],
    groupKey: "event-timeline-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-event-timeline-data",
    registryKeys: ["sp-event-timeline"],
    resolveRuntimeSnapshots: (input) => [input.eventTimelineRuntime],
    resolveSafeControls: (input) => input.eventTimelineSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-event-timeline-data",
    stressCondition: "large event timeline read stability",
    validationName: "Event Timeline Stress Validation",
    validationScope: "SP-10 event timeline stability under large datasets and rapid navigation"
  },
  {
    expectedSources: ["support_search_runtime"],
    groupKey: "search-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-search-data",
    registryKeys: ["sp-search"],
    resolveRuntimeSnapshots: (input) => [input.searchRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-search-data",
    stressCondition: "combined search and filters read stability",
    validationName: "Search Stress Validation",
    validationScope: "SP-11 search stability with combined filters and concurrent read operations"
  },
  {
    expectedSources: ["support_filters_runtime"],
    groupKey: "filters-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-filters-data",
    registryKeys: ["sp-filters"],
    resolveRuntimeSnapshots: (input) => [input.filtersRuntime, input.searchRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-filters-data",
    stressCondition: "combined search and filters read stability",
    validationName: "Filters Stress Validation",
    validationScope: "SP-12 filters stability with combined search and rapid navigation"
  },
  {
    expectedSources: ["support_metrics_runtime"],
    groupKey: "metrics-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-metrics-data",
    registryKeys: ["sp-metrics"],
    resolveRuntimeSnapshots: (input) => [input.metricsRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-metrics-data",
    stressCondition: "large derived metrics read stability",
    validationName: "Metrics Stress Validation",
    validationScope: "SP-13 metrics stability under large datasets and empty states"
  },
  {
    expectedSources: ["support_visibility_runtime"],
    groupKey: "visibility-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-visibility-data",
    registryKeys: ["sp-visibility"],
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-visibility-data",
    stressCondition: "unauthorized and restricted visibility safe fallback",
    validationName: "Visibility Stress Validation",
    validationScope: "SP-14 visibility stability under unauthorized access and restricted records"
  },
  {
    expectedSources: ["support_safe_actions_runtime"],
    groupKey: "safe-actions-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-safe-actions-data",
    registryKeys: ["sp-safe-actions"],
    resolveRuntimeSnapshots: (input) => [input.safeActionsRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-safe-actions-data",
    stressCondition: "explicit Super Admin authorization only without page load execution",
    validationName: "Safe Actions Stress Validation",
    validationScope: "SP-15 safe actions stability with disabled page load execution"
  },
  {
    expectedSources: ["support_audit_runtime"],
    groupKey: "audit-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-audit-data",
    registryKeys: ["sp-audit"],
    resolveRuntimeSnapshots: (input) => [input.auditRuntime],
    resolveSafeControls: (input) => input.auditSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-audit-data",
    stressCondition: "read-only audit metadata stability without secret exposure",
    validationName: "Audit Stress Validation",
    validationScope: "SP-16 audit refresh stability with safe empty states"
  },
  {
    expectedSources: ["support_review_runtime"],
    groupKey: "review-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-review-data",
    registryKeys: ["sp-review"],
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime],
    resolveSafeControls: (input) => input.reviewSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-review-data",
    stressCondition: "derived review metadata stability",
    validationName: "Review Stress Validation",
    validationScope: "SP-17 review refresh stability with derived-only output"
  },
  {
    expectedSources: ["support_notifications_runtime"],
    groupKey: "notifications-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-notifications-data",
    registryKeys: ["sp-notifications"],
    resolveRuntimeSnapshots: (input) => [input.notificationsRuntime],
    resolveSafeControls: (input) => input.notificationsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-notifications-data",
    stressCondition: "concurrent read stability without duplicated notification requests",
    validationName: "Notifications Stress Validation",
    validationScope: "SP-18 notifications refresh stability with disabled controls"
  },
  {
    expectedSources: ["support_analytics_runtime"],
    groupKey: "analytics-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-analytics-data",
    registryKeys: ["sp-analytics"],
    resolveRuntimeSnapshots: (input) => [input.analyticsRuntime],
    resolveSafeControls: (input) => input.analyticsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-analytics-data",
    stressCondition: "large derived analytics read stability",
    validationName: "Analytics Stress Validation",
    validationScope: "SP-19 analytics stability under large datasets and empty states"
  },
  {
    expectedSources: ["support_export_runtime"],
    groupKey: "export-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-export-data",
    registryKeys: ["sp-export"],
    resolveRuntimeSnapshots: (input) => [input.exportRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-export-data",
    stressCondition: "explicit download only without page load export execution",
    validationName: "Export Stress Validation",
    validationScope: "SP-20 export stability with no automatic export on page load"
  },
  {
    expectedSources: ["support_status_runtime"],
    groupKey: "status-stress-validation",
    productionCertificationKey: "sp-production-sp-cert-status-data",
    registryKeys: ["sp-status"],
    resolveRuntimeSnapshots: (input) => [input.statusRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-status-data",
    stressCondition: "derived status metadata under empty, error, and restricted states",
    validationName: "Status Stress Validation",
    validationScope: "SP-21 status refresh stability with safe runtime states"
  },
  {
    expectedSources: [
      "support_data_certification_runtime",
      "support_security_certification_runtime",
      "support_runtime_certification_runtime",
      "support_production_certification_runtime"
    ],
    groupKey: "certification-stress-validation",
    productionCertificationKey: null,
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
    stressCondition: "certification metadata stability without persistence or execution",
    validationName: "Certification Stress Validation",
    validationScope: "SP-22 through SP-25 certification refresh stability and certified system isolation"
  }
] as const;

function buildSafeControls() {
  return SUPPORT_STRESS_VALIDATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectRegistryCounts(input: SupportStressValidationInput, registryKeys: readonly string[]) {
  const reviewItems = input.reviewItems.filter((item) => registryKeys.includes(item.registryKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function validateRuntimeShape(
  snapshots: SupportStressValidationRuntimeSnapshot[],
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

function validateCertifiedSystemIsolation(snapshots: SupportStressValidationRuntimeSnapshot[]) {
  return snapshots.every((snapshot) => String(snapshot.source).startsWith("support_"));
}

function mapProductionStatusToStressStatus(
  status: SupportProductionCertificationItem["readOnlyStatus"] | undefined
): SupportStressValidationStatus {
  switch (status) {
    case "certified":
      return "stable";
    case "warning":
      return "warning";
    case "blocked":
      return "blocked";
    case "review_required":
    default:
      return "review_required";
  }
}

function mapSecuritySecretStatus(item: SupportSecurityCertificationItem | null): SupportStressValidationStatus {
  if (!item) {
    return "review_required";
  }

  return item.secretSafetyStatus === "certified" ? "stable" : "review_required";
}

function resolveEmptyStateSafetyStatus(input: {
  blockedModules: number;
  runtimeShapeValid: boolean;
  warningModules: number;
}): SupportStressValidationStatus {
  if (!input.runtimeShapeValid) {
    return "review_required";
  }

  if (input.blockedModules > 0) {
    return "blocked";
  }

  if (input.warningModules > 0) {
    return "warning";
  }

  return "stable";
}

function resolveMetadataConsistencyStatus(input: {
  productionCertificationItem: SupportProductionCertificationItem | null;
  runtimeShapeValid: boolean;
}): SupportStressValidationStatus {
  if (!input.runtimeShapeValid) {
    return "review_required";
  }

  if (!input.productionCertificationItem) {
    return input.runtimeShapeValid ? "stable" : "review_required";
  }

  switch (input.productionCertificationItem.productionReadinessStatus) {
    case "production_ready":
      return "stable";
    case "warning":
      return "warning";
    case "blocked":
      return "blocked";
    case "review_required":
    default:
      return "review_required";
  }
}

function buildStressValidationItem(
  definition: StressScopeDefinition,
  input: SupportStressValidationInput
): SupportStressValidationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const safeControls = definition.resolveSafeControls(input);
  const productionCertificationItem = definition.productionCertificationKey
    ? input.productionCertificationItems.find(
        (item) => item.productionCertificationKey === definition.productionCertificationKey
      ) ?? null
    : null;
  const securityCertificationItem = definition.securityCertificationKey
    ? input.securityCertificationItems.find(
        (item) => item.securityCertificationKey === definition.securityCertificationKey
      ) ?? null
    : null;
  const moduleCounts =
    definition.groupKey === "certification-stress-validation"
      ? {
          blockedModules: input.productionCertification.blockedScopes,
          warningModules: input.productionCertification.warningScopes
        }
      : collectRegistryCounts(input, definition.registryKeys);
  const refreshStabilityStatus: SupportStressValidationStatus = runtimeShapeValid ? "stable" : "review_required";
  const metadataConsistencyStatus = resolveMetadataConsistencyStatus({
    productionCertificationItem,
    runtimeShapeValid
  });
  const emptyStateSafetyStatus = resolveEmptyStateSafetyStatus({
    blockedModules: moduleCounts.blockedModules,
    runtimeShapeValid,
    warningModules: moduleCounts.warningModules
  });
  const disabledControlsStatus: SupportStressValidationStatus = validateSafeControlsDisabled(safeControls)
    ? "stable"
    : "blocked";
  const executionSafetyStatus = runtimeShapeValid
    ? mapProductionStatusToStressStatus(productionCertificationItem?.executionSafetyStatus)
    : "review_required";
  const mutationSafetyStatus = runtimeShapeValid
    ? mapProductionStatusToStressStatus(productionCertificationItem?.mutationSafetyStatus)
    : "review_required";
  const secretSafetyStatus = mapSecuritySecretStatus(securityCertificationItem);
  const certifiedSystemIsolationStatus: SupportStressValidationStatus =
    runtimeShapeValid && validateCertifiedSystemIsolation(snapshots) ? "stable" : "blocked";

  return {
    blockedModules: moduleCounts.blockedModules,
    certifiedSystemIsolationStatus,
    disabledControlsStatus,
    emptyStateSafetyStatus,
    executionSafetyStatus,
    groupKey: definition.groupKey,
    metadataConsistencyStatus,
    mutationSafetyStatus,
    refreshStabilityStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `condition ${definition.stressCondition}`,
      `refresh ${refreshStabilityStatus}`,
      `metadata ${metadataConsistencyStatus}`,
      `empty state ${emptyStateSafetyStatus}`,
      `controls ${disabledControlsStatus}`,
      `execution ${executionSafetyStatus}`,
      `mutation ${mutationSafetyStatus}`,
      `secrets ${secretSafetyStatus}`,
      `isolation ${certifiedSystemIsolationStatus}`,
      `${moduleCounts.blockedModules} blocked`,
      `${moduleCounts.warningModules} warning`
    ].join("; "),
    secretSafetyStatus,
    stressValidationKey: `sp-stress-${definition.groupKey}`,
    validationName: definition.validationName,
    validationScope: definition.validationScope,
    warningModules: moduleCounts.warningModules
  };
}

export function resolveSupportStressValidationAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportStressValidationAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewStressValidation: true,
      reason: "Super Admin may view Support stress validation through read-only runtime metadata.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewStressValidation: false,
    reason: "Support stress validation is restricted to Super Admin in SP-26.",
    roleLabel: input.role
  };
}

export function isSupportStressScopeStable(item: SupportStressValidationItem) {
  return (
    item.refreshStabilityStatus === "stable" &&
    item.metadataConsistencyStatus === "stable" &&
    item.emptyStateSafetyStatus === "stable" &&
    item.disabledControlsStatus === "stable" &&
    item.executionSafetyStatus === "stable" &&
    item.mutationSafetyStatus === "stable" &&
    item.secretSafetyStatus === "stable" &&
    item.certifiedSystemIsolationStatus === "stable"
  );
}

export function buildSupportStressValidationGroups(
  items: SupportStressValidationItem[]
): SupportStressValidationGroup[] {
  return STRESS_GROUP_DEFINITIONS.map((definition) => {
    const groupItems = items.filter((item) => item.groupKey === definition.groupKey);

    return {
      groupKey: definition.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: definition.title
    };
  }).filter((group) => group.itemCount > 0);
}

function getSupportStressValidationSummary(
  items: SupportStressValidationItem[],
  input: Pick<
    SupportStressValidationInput,
    "authorization" | "hiddenRecordCount" | "loadError" | "restrictedRecordCount" | "role" | "visibilityAuthorization"
  >
): SupportStressValidationSummary {
  const registryEntry = getSupportRegistryEntry("sp-stress-validation");
  const hiddenRecordCount = input.hiddenRecordCount ?? 0;
  const restrictedRecordCount = input.restrictedRecordCount ?? 0;

  if (
    !input.authorization.canViewStressValidation ||
    !input.visibilityAuthorization.canViewSupportData ||
    input.role !== "super_admin"
  ) {
    return {
      blockedScopes: 0,
      emptyMessage: "Support stress validation is hidden for the current account.",
      groupCount: 0,
      loadError: null,
      loadingState: "unauthorized",
      overallStatus: "needs_attention",
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: STRESS_SCOPE_DEFINITIONS.length,
      source: SUPPORT_STRESS_VALIDATION_SOURCE,
      stableScopes: 0,
      summary: input.authorization.reason,
      totalValidations: STRESS_SCOPE_DEFINITIONS.length,
      unauthorizedMessage:
        "Support stress validation is Super Admin only. No stress execution runs during page load.",
      warningScopes: 0
    };
  }

  if (input.loadError) {
    return {
      blockedScopes: items.length,
      emptyMessage: null,
      groupCount: 0,
      loadError: input.loadError,
      loadingState: "error",
      overallStatus: "needs_attention",
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: items.length,
      source: SUPPORT_STRESS_VALIDATION_SOURCE,
      stableScopes: 0,
      summary: `status load_error; ${input.loadError}`,
      totalValidations: items.length,
      unauthorizedMessage: null,
      warningScopes: 0
    };
  }

  const stableScopes = items.filter((item) => isSupportStressScopeStable(item)).length;
  const reviewRequiredScopes = items.filter(
    (item) =>
      !isSupportStressScopeStable(item) &&
      item.refreshStabilityStatus !== "blocked" &&
      item.metadataConsistencyStatus !== "blocked" &&
      item.emptyStateSafetyStatus !== "blocked" &&
      item.disabledControlsStatus !== "blocked" &&
      item.certifiedSystemIsolationStatus !== "blocked"
  ).length;
  const blockedScopes = items.filter(
    (item) =>
      item.refreshStabilityStatus === "blocked" ||
      item.metadataConsistencyStatus === "blocked" ||
      item.emptyStateSafetyStatus === "blocked" ||
      item.disabledControlsStatus === "blocked" ||
      item.executionSafetyStatus === "blocked" ||
      item.mutationSafetyStatus === "blocked" ||
      item.secretSafetyStatus === "blocked" ||
      item.certifiedSystemIsolationStatus === "blocked"
  ).length;
  const warningScopes = items.filter(
    (item) =>
      item.metadataConsistencyStatus === "warning" ||
      item.emptyStateSafetyStatus === "warning" ||
      item.executionSafetyStatus === "warning" ||
      item.mutationSafetyStatus === "warning" ||
      item.secretSafetyStatus === "warning"
  ).length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("support_stress_validation_ready" as const);
  const loadingState: SupportStressValidationLoadingState =
    restrictedRecordCount > 0
      ? "restricted"
      : stableScopes === 0
        ? "empty"
        : overallStatus === "support_stress_validation_ready"
          ? "stable"
          : "restricted";

  return {
    blockedScopes,
    emptyMessage:
      stableScopes === 0 ? "No Support stress validation scopes are stable for the current runtime snapshot." : null,
    groupCount: buildSupportStressValidationGroups(items).length,
    loadError: null,
    loadingState,
    overallStatus,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      restrictedRecordCount > 0
        ? `${restrictedRecordCount} record(s) excluded from Support stress validation under SP-14 visibility rules.`
        : null,
    reviewRequiredScopes,
    source: SUPPORT_STRESS_VALIDATION_SOURCE,
    stableScopes,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} stress validations`,
      `${stableScopes} stable`,
      `${reviewRequiredScopes} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`,
      `${hiddenRecordCount} hidden`,
      registryEntry?.productionReady ? "registry production_ready" : "registry pending"
    ].join("; "),
    totalValidations: items.length,
    unauthorizedMessage: null,
    warningScopes
  };
}

export function supportStressValidationStatusLabel(status: SupportStressValidationStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "review_required":
      return "Review Required";
    case "stable":
      return "Stable";
    case "warning":
      return "Warning";
  }
}

export function supportStressValidationStatusTone(status: SupportStressValidationStatus) {
  switch (status) {
    case "stable":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function supportStressValidationRuntimeStatusBadgeTone(
  status: SupportStressValidationSummary["overallStatus"]
): "amber" | "green" {
  return status === "support_stress_validation_ready" ? "green" : "amber";
}

export function buildSupportStressValidationReadOnlySafe(input: SupportStressValidationInput) {
  const stressValidationItems = STRESS_SCOPE_DEFINITIONS.map((definition) =>
    buildStressValidationItem(definition, input)
  );
  const groups = buildSupportStressValidationGroups(stressValidationItems);
  const stressValidation = getSupportStressValidationSummary(stressValidationItems, input);

  return {
    stressValidation,
    stressValidationGroups: groups,
    stressValidationItems,
    stressValidationSafeControls: buildSafeControls()
  };
}

export function mapSupportStressValidationToAdminFields(
  input: ReturnType<typeof buildSupportStressValidationReadOnlySafe>
) {
  return input;
}

export function toSupportStressValidationSnapshot(input: {
  readOnly?: boolean;
  source?: string;
  summary?: string;
}): SupportStressValidationRuntimeSnapshot {
  return {
    readOnly: input.readOnly ?? true,
    source: input.source,
    summary: input.summary
  };
}
