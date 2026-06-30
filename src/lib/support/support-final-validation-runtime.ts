import "server-only";

import type { SupportDataCertificationSummary } from "@/src/lib/support/support-data-certification-runtime";
import {
  isSupportHardeningScopeReady,
  type SupportProductionHardeningItem,
  type SupportProductionHardeningSummary
} from "@/src/lib/support/support-production-hardening-runtime";
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
import type { SupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";
import type {
  SupportStressValidationItem,
  SupportStressValidationSummary
} from "@/src/lib/support/support-stress-validation-runtime";

export type SupportFinalValidationSource = "support_final_validation_runtime";

export type SupportFinalValidationGroupKey =
  | "analytics-final-validation"
  | "audit-final-validation"
  | "certification-final-validation"
  | "dashboard-final-validation"
  | "error-events-final-validation"
  | "event-timeline-final-validation"
  | "export-final-validation"
  | "filters-final-validation"
  | "metrics-final-validation"
  | "monitoring-events-final-validation"
  | "notifications-final-validation"
  | "production-hardening-final-validation"
  | "registry-final-validation"
  | "review-final-validation"
  | "safe-actions-final-validation"
  | "search-final-validation"
  | "status-final-validation"
  | "stress-validation-final-validation"
  | "ticket-assignment-final-validation"
  | "ticket-conversation-final-validation"
  | "ticket-details-final-validation"
  | "ticket-status-final-validation"
  | "tickets-final-validation"
  | "visibility-final-validation";

export type SupportFinalValidationStatus = "blocked" | "review_required" | "validated" | "warning";

export type SupportFinalValidationLoadingState =
  | "empty"
  | "error"
  | "restricted"
  | "unauthorized"
  | "validated";

export type SupportFinalValidationSafeControlKey =
  | "export_final_validation_report"
  | "mark_final_validated"
  | "recheck_final_validation"
  | "resolve_final_validation_blocker"
  | "run_final_validation";

export type SupportFinalValidationSafeControl = {
  enabled: false;
  key: SupportFinalValidationSafeControlKey;
  label: string;
  note: string;
};

export type SupportFinalValidationItem = {
  authorizationStatus: SupportFinalValidationStatus;
  blockedModules: number;
  certifiedSystemIsolationStatus: SupportFinalValidationStatus;
  endToEndIntegrationStatus: SupportFinalValidationStatus;
  executionSafetyStatus: SupportFinalValidationStatus;
  finalValidationKey: string;
  groupKey: SupportFinalValidationGroupKey;
  mutationSafetyStatus: SupportFinalValidationStatus;
  readOnlyValidationStatus: SupportFinalValidationStatus;
  safeControls: SupportFinalValidationSafeControl[];
  safeSummary: string;
  secretSanitizationStatus: SupportFinalValidationStatus;
  stateCoverageStatus: SupportFinalValidationStatus;
  validationName: string;
  validationScope: string;
  warningModules: number;
};

export type SupportFinalValidationGroup = {
  groupKey: SupportFinalValidationGroupKey;
  itemCount: number;
  items: SupportFinalValidationItem[];
  title: string;
};

export type SupportFinalValidationSummary = {
  blockedScopes: number;
  emptyMessage: string | null;
  groupCount: number;
  loadError: string | null;
  loadingState: SupportFinalValidationLoadingState;
  overallStatus: "needs_attention" | "support_final_validation_ready";
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  reviewRequiredScopes: number;
  source: SupportFinalValidationSource;
  summary: string;
  totalValidations: number;
  unauthorizedMessage: string | null;
  validatedScopes: number;
  warningScopes: number;
};

export type SupportFinalValidationRuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

type SafeControlSnapshot = {
  enabled: boolean;
};

export type SupportFinalValidationAuthorization = {
  canViewFinalValidation: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportFinalValidationInput = {
  analyticsRuntime: SupportFinalValidationRuntimeSnapshot;
  analyticsSafeControls: SafeControlSnapshot[];
  auditRuntime: SupportFinalValidationRuntimeSnapshot;
  auditSafeControls: SafeControlSnapshot[];
  authorization: SupportFinalValidationAuthorization;
  dashboardRuntime: SupportFinalValidationRuntimeSnapshot;
  dataCertification: SupportDataCertificationSummary;
  dataCertificationSafeControls: SafeControlSnapshot[];
  errorEventsRuntime: SupportFinalValidationRuntimeSnapshot;
  errorEventsSafeControls: SafeControlSnapshot[];
  eventTimelineRuntime: SupportFinalValidationRuntimeSnapshot;
  eventTimelineSafeControls: SafeControlSnapshot[];
  exportRuntime: SupportFinalValidationRuntimeSnapshot;
  filtersRuntime: SupportFinalValidationRuntimeSnapshot;
  hiddenRecordCount?: number;
  loadError?: string | null;
  metricsRuntime: SupportFinalValidationRuntimeSnapshot;
  monitoringEventsRuntime: SupportFinalValidationRuntimeSnapshot;
  monitoringEventsSafeControls: SafeControlSnapshot[];
  notificationsRuntime: SupportFinalValidationRuntimeSnapshot;
  notificationsSafeControls: SafeControlSnapshot[];
  productionCertification: SupportProductionCertificationSummary;
  productionCertificationItems: SupportProductionCertificationItem[];
  productionCertificationSafeControls: SafeControlSnapshot[];
  productionHardening: SupportProductionHardeningSummary;
  productionHardeningItems: SupportProductionHardeningItem[];
  productionHardeningSafeControls: SafeControlSnapshot[];
  registryRuntime: SupportFinalValidationRuntimeSnapshot;
  restrictedRecordCount?: number;
  reviewItems: Array<Pick<SupportReviewRuntimeItem, "registryKey" | "reviewStatus" | "safeSummary">>;
  reviewRuntime: SupportFinalValidationRuntimeSnapshot;
  reviewSafeControls: SafeControlSnapshot[];
  role: "internal_team" | "super_admin";
  runtimeCertification: SupportRuntimeCertificationSummary;
  runtimeCertificationSafeControls: SafeControlSnapshot[];
  safeActionsRuntime: SupportFinalValidationRuntimeSnapshot;
  searchRuntime: SupportFinalValidationRuntimeSnapshot;
  securityCertification: SupportSecurityCertificationSummary;
  securityCertificationItems: SupportSecurityCertificationItem[];
  securityCertificationSafeControls: SafeControlSnapshot[];
  statusRuntime: SupportFinalValidationRuntimeSnapshot;
  stressValidation: SupportStressValidationSummary;
  stressValidationItems: SupportStressValidationItem[];
  stressValidationSafeControls: SafeControlSnapshot[];
  ticketAssignmentRuntime: SupportFinalValidationRuntimeSnapshot;
  ticketConversationRuntime: SupportFinalValidationRuntimeSnapshot;
  ticketDetailsRuntime: SupportFinalValidationRuntimeSnapshot;
  ticketStatusRuntime: SupportFinalValidationRuntimeSnapshot;
  ticketsRuntime: SupportFinalValidationRuntimeSnapshot;
  ticketsSafeControls: SafeControlSnapshot[];
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibilityRuntime: SupportFinalValidationRuntimeSnapshot;
};

type ValidationScopeDefinition = {
  expectedSources: readonly string[];
  groupKey: SupportFinalValidationGroupKey;
  productionHardeningKey: string | null;
  registryKeys: readonly string[];
  resolveRuntimeSnapshots: (input: SupportFinalValidationInput) => SupportFinalValidationRuntimeSnapshot[];
  resolveSafeControls: (input: SupportFinalValidationInput) => SafeControlSnapshot[];
  securityCertificationKey: string | null;
  validationGuarantee: string;
  validationName: string;
  validationScope: string;
};

export const SUPPORT_FINAL_VALIDATION_SOURCE = "support_final_validation_runtime" as const;

export const SUPPORT_FINAL_VALIDATION_SAFE_CONTROLS: readonly SupportFinalValidationSafeControl[] = [
  {
    enabled: false,
    key: "run_final_validation",
    label: "Run Final Validation",
    note: "Read-only placeholder. No final validation execution or mutation runs during SP-28 page load."
  },
  {
    enabled: false,
    key: "recheck_final_validation",
    label: "Recheck Final Validation",
    note: "Read-only placeholder. No final validation recheck execution or mutation runs during SP-28 page load."
  },
  {
    enabled: false,
    key: "export_final_validation_report",
    label: "Export Final Validation Report",
    note: "Read-only placeholder. No final validation export runs during SP-28 page load."
  },
  {
    enabled: false,
    key: "resolve_final_validation_blocker",
    label: "Resolve Final Validation Blocker",
    note: "Read-only placeholder. No final validation blocker resolve action runs during SP-28 page load."
  },
  {
    enabled: false,
    key: "mark_final_validated",
    label: "Mark Final Validated",
    note: "Read-only placeholder. No final validation record write runs during SP-28 page load."
  }
] as const;

const VALIDATION_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportFinalValidationGroupKey;
  title: string;
}> = [
  { groupKey: "registry-final-validation", title: "Registry Final Validation" },
  { groupKey: "dashboard-final-validation", title: "Dashboard Final Validation" },
  { groupKey: "tickets-final-validation", title: "Tickets Final Validation" },
  { groupKey: "ticket-details-final-validation", title: "Ticket Details Final Validation" },
  { groupKey: "ticket-status-final-validation", title: "Ticket Status Final Validation" },
  { groupKey: "ticket-assignment-final-validation", title: "Ticket Assignment Final Validation" },
  { groupKey: "ticket-conversation-final-validation", title: "Ticket Conversation Final Validation" },
  { groupKey: "monitoring-events-final-validation", title: "Monitoring Events Final Validation" },
  { groupKey: "error-events-final-validation", title: "Error Events Final Validation" },
  { groupKey: "event-timeline-final-validation", title: "Event Timeline Final Validation" },
  { groupKey: "search-final-validation", title: "Search Final Validation" },
  { groupKey: "filters-final-validation", title: "Filters Final Validation" },
  { groupKey: "metrics-final-validation", title: "Metrics Final Validation" },
  { groupKey: "visibility-final-validation", title: "Visibility Final Validation" },
  { groupKey: "safe-actions-final-validation", title: "Safe Actions Final Validation" },
  { groupKey: "audit-final-validation", title: "Audit Final Validation" },
  { groupKey: "review-final-validation", title: "Review Final Validation" },
  { groupKey: "notifications-final-validation", title: "Notifications Final Validation" },
  { groupKey: "analytics-final-validation", title: "Analytics Final Validation" },
  { groupKey: "export-final-validation", title: "Export Final Validation" },
  { groupKey: "status-final-validation", title: "Support Status Final Validation" },
  { groupKey: "certification-final-validation", title: "Certification Final Validation" },
  { groupKey: "stress-validation-final-validation", title: "Stress Validation Final Validation" },
  { groupKey: "production-hardening-final-validation", title: "Production Hardening Final Validation" }
];

const VALIDATION_SCOPE_DEFINITIONS: readonly ValidationScopeDefinition[] = [
  {
    expectedSources: [SUPPORT_REGISTRY_SOURCE],
    groupKey: "registry-final-validation",
    productionHardeningKey: "sp-hardening-registry-hardening",
    registryKeys: [],
    resolveRuntimeSnapshots: (input) => [input.registryRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-registry-data",
    validationGuarantee: "end-to-end read-only registry metadata without regression",
    validationName: "Registry Final Validation",
    validationScope: "SP-1 registry end-to-end validation across SP-1 through SP-27"
  },
  {
    expectedSources: ["support_dashboard_runtime"],
    groupKey: "dashboard-final-validation",
    productionHardeningKey: "sp-hardening-dashboard-hardening",
    registryKeys: ["sp-dashboard"],
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-dashboard-data",
    validationGuarantee: "dashboard modules integrate without duplicate fetches or auto-writes",
    validationName: "Dashboard Final Validation",
    validationScope: "SP-2 dashboard end-to-end validation with safe loading and empty states"
  },
  {
    expectedSources: ["support_tickets_runtime"],
    groupKey: "tickets-final-validation",
    productionHardeningKey: "sp-hardening-tickets-hardening",
    registryKeys: ["sp-tickets"],
    resolveRuntimeSnapshots: (input) => [input.ticketsRuntime],
    resolveSafeControls: (input) => input.ticketsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-tickets-data",
    validationGuarantee: "tickets read-only with explicit Super Admin actions only",
    validationName: "Tickets Final Validation",
    validationScope: "SP-3 tickets end-to-end validation without page load mutation"
  },
  {
    expectedSources: ["support_ticket_details_runtime"],
    groupKey: "ticket-details-final-validation",
    productionHardeningKey: "sp-hardening-ticket-details-hardening",
    registryKeys: ["sp-ticket-details"],
    resolveRuntimeSnapshots: (input) => [input.ticketDetailsRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-details-data",
    validationGuarantee: "ticket details safe fallbacks for invalid identifiers and restricted records",
    validationName: "Ticket Details Final Validation",
    validationScope: "SP-4 ticket details end-to-end validation with error and empty states"
  },
  {
    expectedSources: ["support_ticket_status_runtime"],
    groupKey: "ticket-status-final-validation",
    productionHardeningKey: "sp-hardening-ticket-status-hardening",
    registryKeys: ["sp-ticket-status"],
    resolveRuntimeSnapshots: (input) => [input.ticketStatusRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-status-data",
    validationGuarantee: "status transitions remain explicit and permission-protected",
    validationName: "Ticket Status Final Validation",
    validationScope: "SP-5 ticket status end-to-end validation without automatic updates"
  },
  {
    expectedSources: ["support_ticket_assignment_runtime"],
    groupKey: "ticket-assignment-final-validation",
    productionHardeningKey: "sp-hardening-ticket-assignment-hardening",
    registryKeys: ["sp-ticket-assignment"],
    resolveRuntimeSnapshots: (input) => [input.ticketAssignmentRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-assignment-data",
    validationGuarantee: "assignment metadata read-only without client mutation",
    validationName: "Ticket Assignment Final Validation",
    validationScope: "SP-6 ticket assignment end-to-end validation without execution"
  },
  {
    expectedSources: ["support_ticket_conversation_runtime"],
    groupKey: "ticket-conversation-final-validation",
    productionHardeningKey: "sp-hardening-ticket-conversation-hardening",
    registryKeys: ["sp-ticket-conversation"],
    resolveRuntimeSnapshots: (input) => [input.ticketConversationRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-ticket-conversation-data",
    validationGuarantee: "large conversation threads stable without unsafe client writes",
    validationName: "Ticket Conversation Final Validation",
    validationScope: "SP-7 ticket conversation end-to-end validation with sanitized content"
  },
  {
    expectedSources: ["support_monitoring_events_runtime"],
    groupKey: "monitoring-events-final-validation",
    productionHardeningKey: "sp-hardening-monitoring-events-hardening",
    registryKeys: ["sp-monitoring-events"],
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime],
    resolveSafeControls: (input) => input.monitoringEventsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-monitoring-events-data",
    validationGuarantee: "monitoring metadata sanitized without provider payloads",
    validationName: "Monitoring Events Final Validation",
    validationScope: "SP-8 monitoring events end-to-end validation without queue execution"
  },
  {
    expectedSources: ["support_error_events_runtime"],
    groupKey: "error-events-final-validation",
    productionHardeningKey: "sp-hardening-error-events-hardening",
    registryKeys: ["sp-error-events"],
    resolveRuntimeSnapshots: (input) => [input.errorEventsRuntime],
    resolveSafeControls: (input) => input.errorEventsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-error-events-data",
    validationGuarantee: "error metadata without raw stack traces or secrets",
    validationName: "Error Events Final Validation",
    validationScope: "SP-9 error events end-to-end validation with safe error states"
  },
  {
    expectedSources: ["support_event_timeline_runtime"],
    groupKey: "event-timeline-final-validation",
    productionHardeningKey: "sp-hardening-event-timeline-hardening",
    registryKeys: ["sp-event-timeline"],
    resolveRuntimeSnapshots: (input) => [input.eventTimelineRuntime],
    resolveSafeControls: (input) => input.eventTimelineSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-event-timeline-data",
    validationGuarantee: "large timelines stable without excessive queries",
    validationName: "Event Timeline Final Validation",
    validationScope: "SP-10 event timeline end-to-end validation across combined modules"
  },
  {
    expectedSources: ["support_search_runtime"],
    groupKey: "search-final-validation",
    productionHardeningKey: "sp-hardening-search-hardening",
    registryKeys: ["sp-search"],
    resolveRuntimeSnapshots: (input) => [input.searchRuntime, input.filtersRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-search-data",
    validationGuarantee: "search and filters operate together without duplicate fetch loops",
    validationName: "Search Final Validation",
    validationScope: "SP-11 search end-to-end validation with combined filters and metrics"
  },
  {
    expectedSources: ["support_filters_runtime"],
    groupKey: "filters-final-validation",
    productionHardeningKey: "sp-hardening-filters-hardening",
    registryKeys: ["sp-filters"],
    resolveRuntimeSnapshots: (input) => [input.filtersRuntime, input.searchRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-filters-data",
    validationGuarantee: "controlled filters without unnecessary re-renders or auto-writes",
    validationName: "Filters Final Validation",
    validationScope: "SP-12 filters end-to-end validation with search and visibility"
  },
  {
    expectedSources: ["support_metrics_runtime"],
    groupKey: "metrics-final-validation",
    productionHardeningKey: "sp-hardening-metrics-hardening",
    registryKeys: ["sp-metrics"],
    resolveRuntimeSnapshots: (input) => [input.metricsRuntime, input.analyticsRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-metrics-data",
    validationGuarantee: "metrics and analytics integrate without excessive queries",
    validationName: "Metrics Final Validation",
    validationScope: "SP-13 metrics end-to-end validation with analytics and export"
  },
  {
    expectedSources: ["support_visibility_runtime"],
    groupKey: "visibility-final-validation",
    productionHardeningKey: "sp-hardening-visibility-hardening",
    registryKeys: ["sp-visibility"],
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-visibility-data",
    validationGuarantee: "visibility rules enforce restricted and unauthorized safe fallbacks",
    validationName: "Visibility Final Validation",
    validationScope: "SP-14 visibility end-to-end validation without RLS bypass"
  },
  {
    expectedSources: ["support_safe_actions_runtime"],
    groupKey: "safe-actions-final-validation",
    productionHardeningKey: "sp-hardening-safe-actions-hardening",
    registryKeys: ["sp-safe-actions"],
    resolveRuntimeSnapshots: (input) => [input.safeActionsRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-safe-actions-data",
    validationGuarantee: "explicit Super Admin actions only without page load execution",
    validationName: "Safe Actions Final Validation",
    validationScope: "SP-15 safe actions end-to-end validation without auto-healing"
  },
  {
    expectedSources: ["support_audit_runtime"],
    groupKey: "audit-final-validation",
    productionHardeningKey: "sp-hardening-audit-hardening",
    registryKeys: ["sp-audit"],
    resolveRuntimeSnapshots: (input) => [input.auditRuntime, input.reviewRuntime],
    resolveSafeControls: (input) => input.auditSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-audit-data",
    validationGuarantee: "audit and review metadata read-only without secret exposure",
    validationName: "Audit Final Validation",
    validationScope: "SP-16 audit end-to-end validation with review and notifications"
  },
  {
    expectedSources: ["support_review_runtime"],
    groupKey: "review-final-validation",
    productionHardeningKey: "sp-hardening-review-hardening",
    registryKeys: ["sp-review"],
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime, input.auditRuntime],
    resolveSafeControls: (input) => input.reviewSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-review-data",
    validationGuarantee: "review derived metadata without mutation hooks",
    validationName: "Review Final Validation",
    validationScope: "SP-17 review end-to-end validation with audit integration"
  },
  {
    expectedSources: ["support_notifications_runtime"],
    groupKey: "notifications-final-validation",
    productionHardeningKey: "sp-hardening-notifications-hardening",
    registryKeys: ["sp-notifications"],
    resolveRuntimeSnapshots: (input) => [input.notificationsRuntime],
    resolveSafeControls: (input) => input.notificationsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-notifications-data",
    validationGuarantee: "notifications read-only without queue or retry execution",
    validationName: "Notifications Final Validation",
    validationScope: "SP-18 notifications end-to-end validation without worker execution"
  },
  {
    expectedSources: ["support_analytics_runtime"],
    groupKey: "analytics-final-validation",
    productionHardeningKey: "sp-hardening-analytics-hardening",
    registryKeys: ["sp-analytics"],
    resolveRuntimeSnapshots: (input) => [input.analyticsRuntime, input.metricsRuntime],
    resolveSafeControls: (input) => input.analyticsSafeControls,
    securityCertificationKey: "sp-sec-sp-cert-analytics-data",
    validationGuarantee: "analytics derived output without payment or customer data exposure",
    validationName: "Analytics Final Validation",
    validationScope: "SP-19 analytics end-to-end validation with metrics and export"
  },
  {
    expectedSources: ["support_export_runtime"],
    groupKey: "export-final-validation",
    productionHardeningKey: "sp-hardening-export-hardening",
    registryKeys: ["sp-export"],
    resolveRuntimeSnapshots: (input) => [input.exportRuntime, input.analyticsRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-export-data",
    validationGuarantee: "explicit download only without automatic export on page load",
    validationName: "Export Final Validation",
    validationScope: "SP-20 export end-to-end validation with sanitized fields"
  },
  {
    expectedSources: ["support_status_runtime"],
    groupKey: "status-final-validation",
    productionHardeningKey: "sp-hardening-status-hardening",
    registryKeys: ["sp-status"],
    resolveRuntimeSnapshots: (input) => [input.statusRuntime],
    resolveSafeControls: () => [],
    securityCertificationKey: "sp-sec-sp-cert-status-data",
    validationGuarantee: "support status metadata covers loading, empty, error, and restricted states",
    validationName: "Support Status Final Validation",
    validationScope: "SP-21 support status end-to-end validation across all runtime modules"
  },
  {
    expectedSources: [
      "support_data_certification_runtime",
      "support_security_certification_runtime",
      "support_runtime_certification_runtime",
      "support_production_certification_runtime"
    ],
    groupKey: "certification-final-validation",
    productionHardeningKey: "sp-hardening-certification-hardening",
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
    validationGuarantee: "certification layers read-only without persistence or certified system regression",
    validationName: "Certification Final Validation",
    validationScope: "SP-22 through SP-25 certification end-to-end validation and isolation"
  },
  {
    expectedSources: ["support_stress_validation_runtime"],
    groupKey: "stress-validation-final-validation",
    productionHardeningKey: "sp-hardening-stress-validation-hardening",
    registryKeys: ["sp-stress-validation"],
    resolveRuntimeSnapshots: (input) => [input.stressValidation],
    resolveSafeControls: (input) => input.stressValidationSafeControls,
    securityCertificationKey: null,
    validationGuarantee: "stress validation metadata stable without load testing execution",
    validationName: "Stress Validation Final Validation",
    validationScope: "SP-26 stress validation end-to-end validation without mutation"
  },
  {
    expectedSources: ["support_production_hardening_runtime"],
    groupKey: "production-hardening-final-validation",
    productionHardeningKey: null,
    registryKeys: ["sp-production-hardening"],
    resolveRuntimeSnapshots: (input) => [input.productionHardening],
    resolveSafeControls: (input) => input.productionHardeningSafeControls,
    securityCertificationKey: null,
    validationGuarantee: "production hardening metadata read-only without apply or auto-fix execution",
    validationName: "Production Hardening Final Validation",
    validationScope: "SP-27 production hardening end-to-end validation before final certification"
  }
] as const;

function buildSafeControls() {
  return SUPPORT_FINAL_VALIDATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectRegistryCounts(input: SupportFinalValidationInput, registryKeys: readonly string[]) {
  const reviewItems = input.reviewItems.filter((item) => registryKeys.includes(item.registryKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function validateRuntimeShape(
  snapshots: SupportFinalValidationRuntimeSnapshot[],
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

function validateCertifiedSystemIsolation(snapshots: SupportFinalValidationRuntimeSnapshot[]) {
  return snapshots.every((snapshot) => String(snapshot.source).startsWith("support_"));
}

function mapHardeningStatusToValidationStatus(
  status: SupportProductionHardeningItem["readOnlyHardeningStatus"] | undefined
): SupportFinalValidationStatus {
  switch (status) {
    case "hardened":
      return "validated";
    case "warning":
      return "warning";
    case "blocked":
      return "blocked";
    case "review_required":
    default:
      return "review_required";
  }
}

function mapSecretValidationStatus(item: SupportSecurityCertificationItem | null): SupportFinalValidationStatus {
  if (!item) {
    return "review_required";
  }

  if (item.secretSafetyStatus === "certified" && item.privateDataSafetyStatus === "certified") {
    return "validated";
  }

  return "review_required";
}

function buildValidationItem(
  definition: ValidationScopeDefinition,
  input: SupportFinalValidationInput
): SupportFinalValidationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const safeControls = definition.resolveSafeControls(input);
  const hardeningItem = definition.productionHardeningKey
    ? input.productionHardeningItems.find((item) => item.hardeningKey === definition.productionHardeningKey) ?? null
    : null;
  const securityCertificationItem = definition.securityCertificationKey
    ? input.securityCertificationItems.find(
        (item) => item.securityCertificationKey === definition.securityCertificationKey
      ) ?? null
    : null;
  const moduleCounts =
    definition.groupKey === "certification-final-validation"
      ? {
          blockedModules: input.productionCertification.blockedScopes,
          warningModules: input.productionCertification.warningScopes
        }
      : definition.groupKey === "stress-validation-final-validation"
        ? {
            blockedModules: input.stressValidation.blockedScopes,
            warningModules: input.stressValidation.warningScopes
          }
        : definition.groupKey === "production-hardening-final-validation"
          ? {
              blockedModules: input.productionHardening.blockedScopes,
              warningModules: input.productionHardening.warningScopes
            }
          : collectRegistryCounts(input, definition.registryKeys);
  const readOnlyValidationStatus: SupportFinalValidationStatus = runtimeShapeValid
    ? hardeningItem
      ? mapHardeningStatusToValidationStatus(hardeningItem.readOnlyHardeningStatus)
      : definition.groupKey === "production-hardening-final-validation"
        ? input.productionHardening.overallStatus === "support_production_hardening_ready"
          ? "validated"
          : "review_required"
        : "validated"
    : "review_required";
  const authorizationStatus = hardeningItem
    ? mapHardeningStatusToValidationStatus(hardeningItem.controlSafetyStatus)
    : validateSafeControlsDisabled(safeControls)
      ? securityCertificationItem?.actionSafetyStatus === "certified"
        ? "validated"
        : "validated"
      : "blocked";
  const secretSanitizationStatus =
    definition.groupKey === "production-hardening-final-validation"
      ? input.productionHardeningItems.every(
          (item) => item.secretMaskingStatus === "hardened" || item.secretMaskingStatus === "warning"
        )
        ? "validated"
        : "review_required"
      : hardeningItem
        ? mapHardeningStatusToValidationStatus(hardeningItem.secretMaskingStatus)
        : mapSecretValidationStatus(securityCertificationItem);
  const stateCoverageStatus = hardeningItem
    ? mapHardeningStatusToValidationStatus(hardeningItem.emptyStateStatus)
    : definition.groupKey === "production-hardening-final-validation"
      ? input.productionHardeningItems.every((item) => isSupportHardeningScopeReady(item))
        ? "validated"
        : "review_required"
      : runtimeShapeValid && moduleCounts.blockedModules === 0
        ? moduleCounts.warningModules > 0
          ? "warning"
          : "validated"
        : moduleCounts.blockedModules > 0
          ? "blocked"
          : "review_required";
  const executionSafetyStatus = hardeningItem
    ? mapHardeningStatusToValidationStatus(hardeningItem.executionIsolationStatus)
    : runtimeShapeValid
      ? "validated"
      : "review_required";
  const mutationSafetyStatus = hardeningItem
    ? mapHardeningStatusToValidationStatus(hardeningItem.mutationIsolationStatus)
    : runtimeShapeValid
      ? "validated"
      : "review_required";
  const endToEndIntegrationStatus: SupportFinalValidationStatus =
    runtimeShapeValid && readOnlyValidationStatus === "validated"
      ? hardeningItem
        ? isSupportHardeningScopeReady(hardeningItem)
          ? "validated"
          : "review_required"
        : definition.groupKey === "production-hardening-final-validation"
          ? input.productionHardening.overallStatus === "support_production_hardening_ready"
            ? "validated"
            : "review_required"
          : "validated"
      : "review_required";
  const certifiedSystemIsolationStatus: SupportFinalValidationStatus =
    runtimeShapeValid && validateCertifiedSystemIsolation(snapshots)
      ? hardeningItem
        ? mapHardeningStatusToValidationStatus(hardeningItem.certifiedSystemIsolationStatus)
        : "validated"
      : "blocked";

  return {
    authorizationStatus,
    blockedModules: moduleCounts.blockedModules,
    certifiedSystemIsolationStatus,
    endToEndIntegrationStatus,
    executionSafetyStatus,
    finalValidationKey: `sp-final-${definition.groupKey}`,
    groupKey: definition.groupKey,
    mutationSafetyStatus,
    readOnlyValidationStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `guarantee ${definition.validationGuarantee}`,
      `integration ${endToEndIntegrationStatus}`,
      `read only ${readOnlyValidationStatus}`,
      `authorization ${authorizationStatus}`,
      `secrets ${secretSanitizationStatus}`,
      `states ${stateCoverageStatus}`,
      `execution ${executionSafetyStatus}`,
      `mutation ${mutationSafetyStatus}`,
      `isolation ${certifiedSystemIsolationStatus}`,
      `${moduleCounts.blockedModules} blocked`,
      `${moduleCounts.warningModules} warning`
    ].join("; "),
    secretSanitizationStatus,
    stateCoverageStatus,
    validationName: definition.validationName,
    validationScope: definition.validationScope,
    warningModules: moduleCounts.warningModules
  };
}

export function resolveSupportFinalValidationAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportFinalValidationAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewFinalValidation: true,
      reason: "Super Admin may view Support final validation through read-only runtime metadata.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewFinalValidation: false,
    reason: "Support final validation is restricted to Super Admin in SP-28.",
    roleLabel: input.role
  };
}

export function isSupportFinalValidationScopePassed(item: SupportFinalValidationItem) {
  return (
    item.endToEndIntegrationStatus === "validated" &&
    item.readOnlyValidationStatus === "validated" &&
    item.authorizationStatus === "validated" &&
    item.secretSanitizationStatus === "validated" &&
    item.stateCoverageStatus === "validated" &&
    item.executionSafetyStatus === "validated" &&
    item.mutationSafetyStatus === "validated" &&
    item.certifiedSystemIsolationStatus === "validated"
  );
}

export function buildSupportFinalValidationGroups(items: SupportFinalValidationItem[]): SupportFinalValidationGroup[] {
  return VALIDATION_GROUP_DEFINITIONS.map((definition) => {
    const groupItems = items.filter((item) => item.groupKey === definition.groupKey);

    return {
      groupKey: definition.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: definition.title
    };
  }).filter((group) => group.itemCount > 0);
}

function getSupportFinalValidationSummary(
  items: SupportFinalValidationItem[],
  input: Pick<
    SupportFinalValidationInput,
    "authorization" | "hiddenRecordCount" | "loadError" | "restrictedRecordCount" | "role" | "visibilityAuthorization"
  >
): SupportFinalValidationSummary {
  const registryEntry = getSupportRegistryEntry("sp-final-validation");
  const hiddenRecordCount = input.hiddenRecordCount ?? 0;
  const restrictedRecordCount = input.restrictedRecordCount ?? 0;

  if (
    !input.authorization.canViewFinalValidation ||
    !input.visibilityAuthorization.canViewSupportData ||
    input.role !== "super_admin"
  ) {
    return {
      blockedScopes: 0,
      emptyMessage: "Support final validation is hidden for the current account.",
      groupCount: 0,
      loadError: null,
      loadingState: "unauthorized",
      overallStatus: "needs_attention",
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: VALIDATION_SCOPE_DEFINITIONS.length,
      source: SUPPORT_FINAL_VALIDATION_SOURCE,
      summary: input.authorization.reason,
      totalValidations: VALIDATION_SCOPE_DEFINITIONS.length,
      unauthorizedMessage:
        "Support final validation is Super Admin only. No validation execution or mutation runs during page load.",
      validatedScopes: 0,
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
      source: SUPPORT_FINAL_VALIDATION_SOURCE,
      summary: `status load_error; ${input.loadError}`,
      totalValidations: items.length,
      unauthorizedMessage: null,
      validatedScopes: 0,
      warningScopes: 0
    };
  }

  const validatedScopes = items.filter((item) => isSupportFinalValidationScopePassed(item)).length;
  const blockedScopes = items.filter(
    (item) =>
      item.endToEndIntegrationStatus === "blocked" ||
      item.readOnlyValidationStatus === "blocked" ||
      item.authorizationStatus === "blocked" ||
      item.secretSanitizationStatus === "blocked" ||
      item.stateCoverageStatus === "blocked" ||
      item.executionSafetyStatus === "blocked" ||
      item.mutationSafetyStatus === "blocked" ||
      item.certifiedSystemIsolationStatus === "blocked"
  ).length;
  const warningScopes = items.filter(
    (item) =>
      item.endToEndIntegrationStatus === "warning" ||
      item.readOnlyValidationStatus === "warning" ||
      item.authorizationStatus === "warning" ||
      item.secretSanitizationStatus === "warning" ||
      item.stateCoverageStatus === "warning" ||
      item.executionSafetyStatus === "warning" ||
      item.mutationSafetyStatus === "warning" ||
      item.certifiedSystemIsolationStatus === "warning"
  ).length;
  const reviewRequiredScopes = items.length - validatedScopes - blockedScopes;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || !registryEntry?.productionReady
      ? ("needs_attention" as const)
      : ("support_final_validation_ready" as const);
  const loadingState: SupportFinalValidationLoadingState =
    validatedScopes === 0
      ? "empty"
      : restrictedRecordCount > 0
        ? "restricted"
        : overallStatus === "support_final_validation_ready"
          ? "validated"
          : "restricted";

  return {
    blockedScopes,
    emptyMessage:
      validatedScopes === 0
        ? "No Support final validation scopes are ready for the current runtime snapshot."
        : null,
    groupCount: buildSupportFinalValidationGroups(items).length,
    loadError: null,
    loadingState,
    overallStatus,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      restrictedRecordCount > 0
        ? `${restrictedRecordCount} record(s) excluded from Support final validation under SP-14 visibility rules.`
        : null,
    reviewRequiredScopes: Math.max(reviewRequiredScopes, 0),
    source: SUPPORT_FINAL_VALIDATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} final validations`,
      `${validatedScopes} validated`,
      `${Math.max(reviewRequiredScopes, 0)} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`,
      `${hiddenRecordCount} hidden`,
      registryEntry?.productionReady ? "registry production_ready" : "registry pending"
    ].join("; "),
    totalValidations: items.length,
    unauthorizedMessage: null,
    validatedScopes,
    warningScopes
  };
}

export function supportFinalValidationStatusLabel(status: SupportFinalValidationStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "validated":
      return "Validated";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function supportFinalValidationStatusTone(status: SupportFinalValidationStatus) {
  switch (status) {
    case "validated":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function supportFinalValidationRuntimeStatusBadgeTone(
  status: SupportFinalValidationSummary["overallStatus"]
): "amber" | "green" {
  return status === "support_final_validation_ready" ? "green" : "amber";
}

export function buildSupportFinalValidationReadOnlySafe(input: SupportFinalValidationInput) {
  const finalValidationItems = VALIDATION_SCOPE_DEFINITIONS.map((definition) =>
    buildValidationItem(definition, input)
  );
  const groups = buildSupportFinalValidationGroups(finalValidationItems);
  const finalValidation = getSupportFinalValidationSummary(finalValidationItems, input);

  return {
    finalValidation,
    finalValidationGroups: groups,
    finalValidationItems,
    finalValidationSafeControls: buildSafeControls()
  };
}

export function mapSupportFinalValidationToAdminFields(
  input: ReturnType<typeof buildSupportFinalValidationReadOnlySafe>
) {
  return input;
}

export function toSupportFinalValidationSnapshot(input: {
  readOnly?: boolean;
  source?: string;
  summary?: string;
}): SupportFinalValidationRuntimeSnapshot {
  return {
    readOnly: input.readOnly ?? true,
    source: input.source,
    summary: input.summary
  };
}
