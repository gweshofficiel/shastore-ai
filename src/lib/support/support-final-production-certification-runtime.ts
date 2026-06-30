import "server-only";

import type {
  SupportDataCertificationItem,
  SupportDataCertificationSummary
} from "@/src/lib/support/support-data-certification-runtime";
import {
  isSupportFinalValidationScopePassed,
  type SupportFinalValidationItem,
  type SupportFinalValidationSummary
} from "@/src/lib/support/support-final-validation-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type {
  SupportProductionCertificationItem,
  SupportProductionCertificationSummary
} from "@/src/lib/support/support-production-certification-runtime";
import {
  isSupportHardeningScopeReady,
  type SupportProductionHardeningItem,
  type SupportProductionHardeningSummary
} from "@/src/lib/support/support-production-hardening-runtime";
import type {
  SupportRuntimeCertificationItem,
  SupportRuntimeCertificationSummary
} from "@/src/lib/support/support-runtime-certification-runtime";
import type { SupportReviewRuntimeItem } from "@/src/lib/support/support-review-runtime";
import type {
  SupportSecurityCertificationItem,
  SupportSecurityCertificationSummary
} from "@/src/lib/support/support-security-certification-runtime";
import {
  isSupportStressScopeStable,
  type SupportStressValidationItem,
  type SupportStressValidationSummary
} from "@/src/lib/support/support-stress-validation-runtime";

export type SupportFinalProductionCertificationSource = "support_final_production_certification_runtime";

export type SupportFinalProductionCertificationGroupKey =
  | "analytics-final-certification"
  | "audit-final-certification"
  | "dashboard-final-certification"
  | "data-final-certification"
  | "error-events-final-certification"
  | "event-timeline-final-certification"
  | "export-final-certification"
  | "filters-final-certification"
  | "final-validation-final-certification"
  | "hardening-final-certification"
  | "metrics-final-certification"
  | "monitoring-events-final-certification"
  | "notifications-final-certification"
  | "production-final-certification"
  | "registry-final-certification"
  | "review-final-certification"
  | "runtime-final-certification"
  | "safe-actions-final-certification"
  | "search-final-certification"
  | "security-final-certification"
  | "status-final-certification"
  | "stress-validation-final-certification"
  | "ticket-assignment-final-certification"
  | "ticket-conversation-final-certification"
  | "ticket-details-final-certification"
  | "ticket-status-final-certification"
  | "tickets-final-certification"
  | "visibility-final-certification";

export type SupportFinalCertificationStatus = "blocked" | "certified" | "review_required" | "warning";

export type SupportFinalProductionStatus = "blocked" | "final_production_certified" | "review_required" | "warning";

export type SupportFinalProductionCertificationSafeControlKey =
  | "approve_final_certification"
  | "export_final_report"
  | "mark_final_certified"
  | "recheck_final_production"
  | "resolve_final_blocker";

export type SupportFinalProductionCertificationSafeControl = {
  enabled: false;
  key: SupportFinalProductionCertificationSafeControlKey;
  label: string;
  note: string;
};

export type SupportFinalProductionCertificationItem = {
  blockedModules: number;
  certificationName: string;
  certificationScope: string;
  certifiedModules: number;
  dataSafetyStatus: SupportFinalCertificationStatus;
  executionSafetyStatus: SupportFinalCertificationStatus;
  finalCertificationKey: string;
  finalProductionStatus: SupportFinalProductionStatus;
  groupKey: SupportFinalProductionCertificationGroupKey;
  hardeningStatus: SupportFinalCertificationStatus;
  mutationSafetyStatus: SupportFinalCertificationStatus;
  readOnlyStatus: SupportFinalCertificationStatus;
  runtimeIntegrityStatus: SupportFinalCertificationStatus;
  safeControls: SupportFinalProductionCertificationSafeControl[];
  safeSummary: string;
  securitySafetyStatus: SupportFinalCertificationStatus;
  warningModules: number;
};

export type SupportFinalProductionCertificationGroup = {
  groupKey: SupportFinalProductionCertificationGroupKey;
  itemCount: number;
  items: SupportFinalProductionCertificationItem[];
  title: string;
};

export type SupportFinalProductionCertificationSummary = {
  blockedScopes: number;
  certifiedScopes: number;
  groupCount: number;
  overallStatus: "needs_attention" | "support_final_production_certification_ready";
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  reviewRequiredScopes: number;
  source: SupportFinalProductionCertificationSource;
  summary: string;
  totalCertifications: number;
  warningScopes: number;
};

export const SUPPORT_FINAL_PRODUCTION_CERTIFICATION_BADGES = [
  "Support Runtime Conversion",
  "Final Production Certified",
  "Super Admin Only",
  "Read-only",
  "Non-executing",
  "Non-destructive"
] as const;

type RuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

export type SupportFinalProductionCertificationInput = {
  analyticsRuntime: RuntimeSnapshot;
  auditRuntime: RuntimeSnapshot;
  dashboardRuntime: RuntimeSnapshot;
  dataCertification: SupportDataCertificationSummary;
  dataCertificationItems: SupportDataCertificationItem[];
  errorEventsRuntime: RuntimeSnapshot;
  eventTimelineRuntime: RuntimeSnapshot;
  exportRuntime: RuntimeSnapshot;
  filtersRuntime: RuntimeSnapshot;
  finalValidation: SupportFinalValidationSummary;
  finalValidationItems: SupportFinalValidationItem[];
  metricsRuntime: RuntimeSnapshot;
  monitoringEventsRuntime: RuntimeSnapshot;
  notificationsRuntime: RuntimeSnapshot;
  productionCertification: SupportProductionCertificationSummary;
  productionCertificationItems: SupportProductionCertificationItem[];
  productionHardening: SupportProductionHardeningSummary;
  productionHardeningItems: SupportProductionHardeningItem[];
  registryRuntime: RuntimeSnapshot;
  reviewItems: Array<Pick<SupportReviewRuntimeItem, "registryKey" | "reviewStatus" | "safeSummary">>;
  reviewRuntime: RuntimeSnapshot;
  runtimeCertification: SupportRuntimeCertificationSummary;
  runtimeCertificationItems: SupportRuntimeCertificationItem[];
  safeActionsRuntime: RuntimeSnapshot;
  searchRuntime: RuntimeSnapshot;
  securityCertification: SupportSecurityCertificationSummary;
  securityCertificationItems: SupportSecurityCertificationItem[];
  statusRuntime: RuntimeSnapshot;
  stressValidation: SupportStressValidationSummary;
  stressValidationItems: SupportStressValidationItem[];
  ticketAssignmentRuntime: RuntimeSnapshot;
  ticketConversationRuntime: RuntimeSnapshot;
  ticketDetailsRuntime: RuntimeSnapshot;
  ticketStatusRuntime: RuntimeSnapshot;
  ticketsRuntime: RuntimeSnapshot;
  visibilityRuntime: RuntimeSnapshot;
};

type FinalScopeDefinition = {
  certificationName: string;
  certificationScope: string;
  dataCertificationKey: string | null;
  expectedSources: readonly string[];
  finalGuarantee: string;
  finalValidationGroupKey: string | null;
  groupKey: SupportFinalProductionCertificationGroupKey;
  hardeningGroupKey: string | null;
  productionCertificationKey: string | null;
  registryKeys: readonly string[];
  resolveRuntimeSnapshots: (input: SupportFinalProductionCertificationInput) => RuntimeSnapshot[];
  runtimeCertificationKey: string | null;
  securityCertificationKey: string | null;
  stressValidationGroupKey: string | null;
};

export const SUPPORT_FINAL_PRODUCTION_CERTIFICATION_SOURCE =
  "support_final_production_certification_runtime" as const;

export const SUPPORT_FINAL_PRODUCTION_CERTIFICATION_SAFE_CONTROLS: readonly SupportFinalProductionCertificationSafeControl[] =
  [
    {
      enabled: false,
      key: "approve_final_certification",
      label: "Approve Final Certification",
      note: "Read-only placeholder. No final certification approval or mutation runs during SP-29 page load."
    },
    {
      enabled: false,
      key: "recheck_final_production",
      label: "Recheck Final Production",
      note: "Read-only placeholder. No final production recheck execution or mutation runs during SP-29 page load."
    },
    {
      enabled: false,
      key: "export_final_report",
      label: "Export Final Report",
      note: "Read-only placeholder. No final export runs during SP-29 page load."
    },
    {
      enabled: false,
      key: "resolve_final_blocker",
      label: "Resolve Final Blocker",
      note: "Read-only placeholder. No final blocker resolve action runs during SP-29 page load."
    },
    {
      enabled: false,
      key: "mark_final_certified",
      label: "Mark Final Certified",
      note: "Read-only placeholder. No final certification record write runs during SP-29 page load."
    }
  ] as const;

const FINAL_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportFinalProductionCertificationGroupKey;
  title: string;
}> = [
  { groupKey: "registry-final-certification", title: "Registry Final Certification" },
  { groupKey: "dashboard-final-certification", title: "Dashboard Final Certification" },
  { groupKey: "tickets-final-certification", title: "Tickets Final Certification" },
  { groupKey: "ticket-details-final-certification", title: "Ticket Details Final Certification" },
  { groupKey: "ticket-status-final-certification", title: "Ticket Status Final Certification" },
  { groupKey: "ticket-assignment-final-certification", title: "Ticket Assignment Final Certification" },
  { groupKey: "ticket-conversation-final-certification", title: "Ticket Conversation Final Certification" },
  { groupKey: "monitoring-events-final-certification", title: "Monitoring Events Final Certification" },
  { groupKey: "error-events-final-certification", title: "Error Events Final Certification" },
  { groupKey: "event-timeline-final-certification", title: "Event Timeline Final Certification" },
  { groupKey: "search-final-certification", title: "Search Final Certification" },
  { groupKey: "filters-final-certification", title: "Filters Final Certification" },
  { groupKey: "metrics-final-certification", title: "Metrics Final Certification" },
  { groupKey: "visibility-final-certification", title: "Visibility Final Certification" },
  { groupKey: "safe-actions-final-certification", title: "Safe Actions Final Certification" },
  { groupKey: "audit-final-certification", title: "Audit Final Certification" },
  { groupKey: "review-final-certification", title: "Review Final Certification" },
  { groupKey: "notifications-final-certification", title: "Notifications Final Certification" },
  { groupKey: "analytics-final-certification", title: "Analytics Final Certification" },
  { groupKey: "export-final-certification", title: "Export Final Certification" },
  { groupKey: "status-final-certification", title: "Support Status Final Certification" },
  { groupKey: "data-final-certification", title: "Data Final Certification" },
  { groupKey: "security-final-certification", title: "Security Final Certification" },
  { groupKey: "runtime-final-certification", title: "Runtime Final Certification" },
  { groupKey: "production-final-certification", title: "Production Final Certification" },
  { groupKey: "stress-validation-final-certification", title: "Stress Validation Final Certification" },
  { groupKey: "hardening-final-certification", title: "Production Hardening Final Certification" },
  { groupKey: "final-validation-final-certification", title: "Final Validation Final Certification" }
];

function moduleScope(input: {
  certificationName: string;
  certificationScope: string;
  dataCertificationKey: string;
  expectedSources: readonly string[];
  finalGuarantee: string;
  finalValidationGroupKey: string;
  groupKey: SupportFinalProductionCertificationGroupKey;
  hardeningGroupKey: string;
  registryKeys: readonly string[];
  resolveRuntimeSnapshots: (input: SupportFinalProductionCertificationInput) => RuntimeSnapshot[];
  stressValidationGroupKey: string;
}): FinalScopeDefinition {
  return {
    ...input,
    productionCertificationKey: `sp-production-${input.dataCertificationKey}`,
    registryKeys: input.registryKeys,
    runtimeCertificationKey: `sp-runtime-${input.dataCertificationKey}`,
    securityCertificationKey: `sp-sec-${input.dataCertificationKey}`
  };
}

const FINAL_SCOPE_DEFINITIONS: readonly FinalScopeDefinition[] = [
  moduleScope({
    certificationName: "Support Registry Final Certification",
    certificationScope: "SP-1 Support Registry is complete and final production certified",
    dataCertificationKey: "sp-cert-registry-data",
    expectedSources: [SUPPORT_REGISTRY_SOURCE],
    finalGuarantee: "Support Registry is complete",
    finalValidationGroupKey: "registry-final-validation",
    groupKey: "registry-final-certification",
    hardeningGroupKey: "registry-hardening",
    registryKeys: [],
    resolveRuntimeSnapshots: (input) => [input.registryRuntime],
    stressValidationGroupKey: "registry-stress-validation"
  }),
  moduleScope({
    certificationName: "Support Dashboard Final Certification",
    certificationScope: "SP-2 Support Dashboard is registry-derived and final production certified",
    dataCertificationKey: "sp-cert-dashboard-data",
    expectedSources: ["support_dashboard_runtime"],
    finalGuarantee: "Support Dashboard is registry-derived",
    finalValidationGroupKey: "dashboard-final-validation",
    groupKey: "dashboard-final-certification",
    hardeningGroupKey: "dashboard-hardening",
    registryKeys: ["sp-dashboard"],
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime],
    stressValidationGroupKey: "dashboard-stress-validation"
  }),
  moduleScope({
    certificationName: "Tickets Final Certification",
    certificationScope: "SP-3 Support Tickets runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-tickets-data",
    expectedSources: ["support_tickets_runtime"],
    finalGuarantee: "Support Tickets are read-only",
    finalValidationGroupKey: "tickets-final-validation",
    groupKey: "tickets-final-certification",
    hardeningGroupKey: "tickets-hardening",
    registryKeys: ["sp-tickets"],
    resolveRuntimeSnapshots: (input) => [input.ticketsRuntime],
    stressValidationGroupKey: "tickets-stress-validation"
  }),
  moduleScope({
    certificationName: "Ticket Details Final Certification",
    certificationScope: "SP-4 Support Ticket Details runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-ticket-details-data",
    expectedSources: ["support_ticket_details_runtime"],
    finalGuarantee: "Support Ticket Details are read-only",
    finalValidationGroupKey: "ticket-details-final-validation",
    groupKey: "ticket-details-final-certification",
    hardeningGroupKey: "ticket-details-hardening",
    registryKeys: ["sp-ticket-details"],
    resolveRuntimeSnapshots: (input) => [input.ticketDetailsRuntime],
    stressValidationGroupKey: "ticket-details-stress-validation"
  }),
  moduleScope({
    certificationName: "Ticket Status Final Certification",
    certificationScope: "SP-5 Support Ticket Status runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-ticket-status-data",
    expectedSources: ["support_ticket_status_runtime"],
    finalGuarantee: "Support Ticket Status is read-only",
    finalValidationGroupKey: "ticket-status-final-validation",
    groupKey: "ticket-status-final-certification",
    hardeningGroupKey: "ticket-status-hardening",
    registryKeys: ["sp-ticket-status"],
    resolveRuntimeSnapshots: (input) => [input.ticketStatusRuntime],
    stressValidationGroupKey: "ticket-status-stress-validation"
  }),
  moduleScope({
    certificationName: "Ticket Assignment Final Certification",
    certificationScope: "SP-6 Support Ticket Assignment runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-ticket-assignment-data",
    expectedSources: ["support_ticket_assignment_runtime"],
    finalGuarantee: "Support Ticket Assignment is read-only",
    finalValidationGroupKey: "ticket-assignment-final-validation",
    groupKey: "ticket-assignment-final-certification",
    hardeningGroupKey: "ticket-assignment-hardening",
    registryKeys: ["sp-ticket-assignment"],
    resolveRuntimeSnapshots: (input) => [input.ticketAssignmentRuntime],
    stressValidationGroupKey: "ticket-assignment-stress-validation"
  }),
  moduleScope({
    certificationName: "Ticket Conversation Final Certification",
    certificationScope: "SP-7 Support Ticket Conversation runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-ticket-conversation-data",
    expectedSources: ["support_ticket_conversation_runtime"],
    finalGuarantee: "Support Ticket Conversation is read-only",
    finalValidationGroupKey: "ticket-conversation-final-validation",
    groupKey: "ticket-conversation-final-certification",
    hardeningGroupKey: "ticket-conversation-hardening",
    registryKeys: ["sp-ticket-conversation"],
    resolveRuntimeSnapshots: (input) => [input.ticketConversationRuntime],
    stressValidationGroupKey: "ticket-conversation-stress-validation"
  }),
  moduleScope({
    certificationName: "Monitoring Events Final Certification",
    certificationScope: "SP-8 Support Monitoring Events runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-monitoring-events-data",
    expectedSources: ["support_monitoring_events_runtime"],
    finalGuarantee: "Support Monitoring Events are read-only",
    finalValidationGroupKey: "monitoring-events-final-validation",
    groupKey: "monitoring-events-final-certification",
    hardeningGroupKey: "monitoring-events-hardening",
    registryKeys: ["sp-monitoring-events"],
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime],
    stressValidationGroupKey: "monitoring-events-stress-validation"
  }),
  moduleScope({
    certificationName: "Error Events Final Certification",
    certificationScope: "SP-9 Support Error Events runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-error-events-data",
    expectedSources: ["support_error_events_runtime"],
    finalGuarantee: "Support Error Events are read-only",
    finalValidationGroupKey: "error-events-final-validation",
    groupKey: "error-events-final-certification",
    hardeningGroupKey: "error-events-hardening",
    registryKeys: ["sp-error-events"],
    resolveRuntimeSnapshots: (input) => [input.errorEventsRuntime],
    stressValidationGroupKey: "error-events-stress-validation"
  }),
  moduleScope({
    certificationName: "Event Timeline Final Certification",
    certificationScope: "SP-10 Support Event Timeline runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-event-timeline-data",
    expectedSources: ["support_event_timeline_runtime"],
    finalGuarantee: "Support Event Timeline is read-only",
    finalValidationGroupKey: "event-timeline-final-validation",
    groupKey: "event-timeline-final-certification",
    hardeningGroupKey: "event-timeline-hardening",
    registryKeys: ["sp-event-timeline"],
    resolveRuntimeSnapshots: (input) => [input.eventTimelineRuntime],
    stressValidationGroupKey: "event-timeline-stress-validation"
  }),
  moduleScope({
    certificationName: "Search Final Certification",
    certificationScope: "SP-11 Support Search runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-search-data",
    expectedSources: ["support_search_runtime"],
    finalGuarantee: "Support Search is read-only",
    finalValidationGroupKey: "search-final-validation",
    groupKey: "search-final-certification",
    hardeningGroupKey: "search-hardening",
    registryKeys: ["sp-search"],
    resolveRuntimeSnapshots: (input) => [input.searchRuntime],
    stressValidationGroupKey: "search-stress-validation"
  }),
  moduleScope({
    certificationName: "Filters Final Certification",
    certificationScope: "SP-12 Support Filters runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-filters-data",
    expectedSources: ["support_filters_runtime"],
    finalGuarantee: "Support Filters are read-only",
    finalValidationGroupKey: "filters-final-validation",
    groupKey: "filters-final-certification",
    hardeningGroupKey: "filters-hardening",
    registryKeys: ["sp-filters"],
    resolveRuntimeSnapshots: (input) => [input.filtersRuntime],
    stressValidationGroupKey: "filters-stress-validation"
  }),
  moduleScope({
    certificationName: "Metrics Final Certification",
    certificationScope: "SP-13 Support Metrics runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-metrics-data",
    expectedSources: ["support_metrics_runtime"],
    finalGuarantee: "Support Metrics are read-only",
    finalValidationGroupKey: "metrics-final-validation",
    groupKey: "metrics-final-certification",
    hardeningGroupKey: "metrics-hardening",
    registryKeys: ["sp-metrics"],
    resolveRuntimeSnapshots: (input) => [input.metricsRuntime],
    stressValidationGroupKey: "metrics-stress-validation"
  }),
  moduleScope({
    certificationName: "Visibility Final Certification",
    certificationScope: "SP-14 Support Visibility runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-visibility-data",
    expectedSources: ["support_visibility_runtime"],
    finalGuarantee: "Support Visibility is read-only",
    finalValidationGroupKey: "visibility-final-validation",
    groupKey: "visibility-final-certification",
    hardeningGroupKey: "visibility-hardening",
    registryKeys: ["sp-visibility"],
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime],
    stressValidationGroupKey: "visibility-stress-validation"
  }),
  moduleScope({
    certificationName: "Safe Actions Final Certification",
    certificationScope: "SP-15 Support Safe Actions runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-safe-actions-data",
    expectedSources: ["support_safe_actions_runtime"],
    finalGuarantee: "Support Safe Actions are read-only",
    finalValidationGroupKey: "safe-actions-final-validation",
    groupKey: "safe-actions-final-certification",
    hardeningGroupKey: "safe-actions-hardening",
    registryKeys: ["sp-safe-actions"],
    resolveRuntimeSnapshots: (input) => [input.safeActionsRuntime],
    stressValidationGroupKey: "safe-actions-stress-validation"
  }),
  moduleScope({
    certificationName: "Audit Final Certification",
    certificationScope: "SP-16 Support Audit runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-audit-data",
    expectedSources: ["support_audit_runtime"],
    finalGuarantee: "Support Audit is read-only",
    finalValidationGroupKey: "audit-final-validation",
    groupKey: "audit-final-certification",
    hardeningGroupKey: "audit-hardening",
    registryKeys: ["sp-audit"],
    resolveRuntimeSnapshots: (input) => [input.auditRuntime],
    stressValidationGroupKey: "audit-stress-validation"
  }),
  moduleScope({
    certificationName: "Review Final Certification",
    certificationScope: "SP-17 Support Review runtime is derived only and final production certified",
    dataCertificationKey: "sp-cert-review-data",
    expectedSources: ["support_review_runtime"],
    finalGuarantee: "Support Review is derived only",
    finalValidationGroupKey: "review-final-validation",
    groupKey: "review-final-certification",
    hardeningGroupKey: "review-hardening",
    registryKeys: ["sp-review"],
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime],
    stressValidationGroupKey: "review-stress-validation"
  }),
  moduleScope({
    certificationName: "Notifications Final Certification",
    certificationScope: "SP-18 Support Notifications runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-notifications-data",
    expectedSources: ["support_notifications_runtime"],
    finalGuarantee: "Support Notifications are read-only",
    finalValidationGroupKey: "notifications-final-validation",
    groupKey: "notifications-final-certification",
    hardeningGroupKey: "notifications-hardening",
    registryKeys: ["sp-notifications"],
    resolveRuntimeSnapshots: (input) => [input.notificationsRuntime],
    stressValidationGroupKey: "notifications-stress-validation"
  }),
  moduleScope({
    certificationName: "Analytics Final Certification",
    certificationScope: "SP-19 Support Analytics runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-analytics-data",
    expectedSources: ["support_analytics_runtime"],
    finalGuarantee: "Support Analytics are read-only",
    finalValidationGroupKey: "analytics-final-validation",
    groupKey: "analytics-final-certification",
    hardeningGroupKey: "analytics-hardening",
    registryKeys: ["sp-analytics"],
    resolveRuntimeSnapshots: (input) => [input.analyticsRuntime],
    stressValidationGroupKey: "analytics-stress-validation"
  }),
  moduleScope({
    certificationName: "Export Final Certification",
    certificationScope: "SP-20 Support Export runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-export-data",
    expectedSources: ["support_export_runtime"],
    finalGuarantee: "Support Export is read-only",
    finalValidationGroupKey: "export-final-validation",
    groupKey: "export-final-certification",
    hardeningGroupKey: "export-hardening",
    registryKeys: ["sp-export"],
    resolveRuntimeSnapshots: (input) => [input.exportRuntime],
    stressValidationGroupKey: "export-stress-validation"
  }),
  moduleScope({
    certificationName: "Support Status Final Certification",
    certificationScope: "SP-21 Support Status runtime is read-only and final production certified",
    dataCertificationKey: "sp-cert-status-data",
    expectedSources: ["support_status_runtime"],
    finalGuarantee: "Support Status is read-only",
    finalValidationGroupKey: "status-final-validation",
    groupKey: "status-final-certification",
    hardeningGroupKey: "status-hardening",
    registryKeys: ["sp-status"],
    resolveRuntimeSnapshots: (input) => [input.statusRuntime],
    stressValidationGroupKey: "status-stress-validation"
  }),
  {
    certificationName: "Data Final Certification",
    certificationScope: "SP-22 Support Data Certification is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["support_data_certification_runtime"],
    finalGuarantee: "Support Data Certification is read-only",
    finalValidationGroupKey: "certification-final-validation",
    groupKey: "data-final-certification",
    hardeningGroupKey: "certification-hardening",
    productionCertificationKey: "sp-production-data-certification-review",
    registryKeys: ["sp-data-certification"],
    resolveRuntimeSnapshots: (input) => [input.dataCertification],
    runtimeCertificationKey: "sp-runtime-data-certification-review",
    securityCertificationKey: "sp-sec-data-certification-security-review",
    stressValidationGroupKey: "certification-stress-validation"
  },
  {
    certificationName: "Security Final Certification",
    certificationScope: "SP-23 Support Security Certification is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["support_security_certification_runtime"],
    finalGuarantee: "Support Security Certification is read-only",
    finalValidationGroupKey: "certification-final-validation",
    groupKey: "security-final-certification",
    hardeningGroupKey: "certification-hardening",
    productionCertificationKey: "sp-production-security-certification-review",
    registryKeys: ["sp-security-certification"],
    resolveRuntimeSnapshots: (input) => [input.securityCertification],
    runtimeCertificationKey: "sp-runtime-security-certification-review",
    securityCertificationKey: "sp-sec-data-certification-security-review",
    stressValidationGroupKey: "certification-stress-validation"
  },
  {
    certificationName: "Runtime Final Certification",
    certificationScope: "SP-24 Support Runtime Certification is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["support_runtime_certification_runtime"],
    finalGuarantee: "Support Runtime Certification is read-only",
    finalValidationGroupKey: "certification-final-validation",
    groupKey: "runtime-final-certification",
    hardeningGroupKey: "certification-hardening",
    productionCertificationKey: "sp-production-runtime-certification-review",
    registryKeys: ["sp-runtime-certification"],
    resolveRuntimeSnapshots: (input) => [input.runtimeCertification],
    runtimeCertificationKey: null,
    securityCertificationKey: null,
    stressValidationGroupKey: "certification-stress-validation"
  },
  {
    certificationName: "Production Final Certification",
    certificationScope: "SP-25 Support Production Certification is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["support_production_certification_runtime"],
    finalGuarantee: "Support Production Certification is read-only",
    finalValidationGroupKey: "certification-final-validation",
    groupKey: "production-final-certification",
    hardeningGroupKey: "certification-hardening",
    productionCertificationKey: null,
    registryKeys: ["sp-production-certification"],
    resolveRuntimeSnapshots: (input) => [input.productionCertification],
    runtimeCertificationKey: null,
    securityCertificationKey: null,
    stressValidationGroupKey: "certification-stress-validation"
  },
  {
    certificationName: "Stress Validation Final Certification",
    certificationScope: "SP-26 Support Stress Validation is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["support_stress_validation_runtime"],
    finalGuarantee: "Support Stress Validation is read-only",
    finalValidationGroupKey: "stress-validation-final-validation",
    groupKey: "stress-validation-final-certification",
    hardeningGroupKey: "stress-validation-hardening",
    productionCertificationKey: null,
    registryKeys: ["sp-stress-validation"],
    resolveRuntimeSnapshots: (input) => [input.stressValidation],
    runtimeCertificationKey: null,
    securityCertificationKey: null,
    stressValidationGroupKey: null
  },
  {
    certificationName: "Production Hardening Final Certification",
    certificationScope: "SP-27 Support Production Hardening is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["support_production_hardening_runtime"],
    finalGuarantee: "Support Production Hardening is read-only",
    finalValidationGroupKey: "production-hardening-final-validation",
    groupKey: "hardening-final-certification",
    hardeningGroupKey: null,
    productionCertificationKey: null,
    registryKeys: ["sp-production-hardening"],
    resolveRuntimeSnapshots: (input) => [input.productionHardening],
    runtimeCertificationKey: null,
    securityCertificationKey: null,
    stressValidationGroupKey: null
  },
  {
    certificationName: "Final Validation Final Certification",
    certificationScope: "SP-28 Support Final Validation is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["support_final_validation_runtime"],
    finalGuarantee: "Support Final Validation is read-only",
    finalValidationGroupKey: null,
    groupKey: "final-validation-final-certification",
    hardeningGroupKey: null,
    productionCertificationKey: null,
    registryKeys: ["sp-final-validation"],
    resolveRuntimeSnapshots: (input) => [input.finalValidation],
    runtimeCertificationKey: null,
    securityCertificationKey: null,
    stressValidationGroupKey: null
  }
] as const;

function buildSafeControls() {
  return SUPPORT_FINAL_PRODUCTION_CERTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectModuleCounts(input: SupportFinalProductionCertificationInput, registryKeys: readonly string[]) {
  const reviewItems = input.reviewItems.filter((item) => registryKeys.includes(item.registryKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    certifiedModules: reviewItems.filter((item) => item.reviewStatus === "clear").length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function validateRuntimeShape(snapshots: RuntimeSnapshot[], expectedSources: readonly string[]) {
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

function mapHardeningStatus(item: SupportProductionHardeningItem | null): SupportFinalCertificationStatus {
  if (!item) {
    return "review_required";
  }

  return isSupportHardeningScopeReady(item)
    ? "certified"
    : item.readOnlyHardeningStatus === "blocked"
      ? "blocked"
      : "review_required";
}

function mapDataSafetyStatus(item: SupportDataCertificationItem | null): SupportFinalCertificationStatus {
  if (!item) {
    return "review_required";
  }

  if (item.dataIntegrityStatus === "blocked") {
    return "blocked";
  }

  if (item.dataIntegrityStatus === "warning") {
    return "warning";
  }

  if (item.dataIntegrityStatus === "certified" && item.mutationSafetyStatus === "read_only_certified") {
    return "certified";
  }

  return "review_required";
}

function mapRuntimeCertificationStatus(
  item: SupportRuntimeCertificationItem | null,
  field: keyof Pick<
    SupportRuntimeCertificationItem,
    "dataSafetyStatus" | "executionSafetyStatus" | "mutationSafetyStatus" | "readOnlyStatus" | "runtimeIntegrityStatus" | "securitySafetyStatus"
  >
): SupportFinalCertificationStatus {
  if (!item) {
    return "review_required";
  }

  return item[field];
}

function mapSecurityStatus(item: SupportSecurityCertificationItem | null): SupportFinalCertificationStatus {
  if (!item) {
    return "review_required";
  }

  return item.secretSafetyStatus === "certified" && item.privateDataSafetyStatus === "certified"
    ? "certified"
    : "review_required";
}

function isMetaCertificationScope(groupKey: SupportFinalProductionCertificationGroupKey) {
  return (
    groupKey === "data-final-certification" ||
    groupKey === "security-final-certification" ||
    groupKey === "runtime-final-certification" ||
    groupKey === "production-final-certification" ||
    groupKey === "stress-validation-final-certification" ||
    groupKey === "hardening-final-certification" ||
    groupKey === "final-validation-final-certification"
  );
}

function resolveFinalProductionStatus(input: {
  blockedModules: number;
  dataSafetyStatus: SupportFinalCertificationStatus;
  executionSafetyStatus: SupportFinalCertificationStatus;
  finalValidationStable: boolean;
  hardeningStatus: SupportFinalCertificationStatus;
  mutationSafetyStatus: SupportFinalCertificationStatus;
  readOnlyStatus: SupportFinalCertificationStatus;
  runtimeIntegrityStatus: SupportFinalCertificationStatus;
  runtimeShapeValid: boolean;
  securitySafetyStatus: SupportFinalCertificationStatus;
  stressStable: boolean;
  warningModules: number;
}): SupportFinalProductionStatus {
  if (
    !input.runtimeShapeValid ||
    !input.finalValidationStable ||
    input.blockedModules > 0 ||
    input.runtimeIntegrityStatus === "blocked" ||
    input.dataSafetyStatus === "blocked" ||
    input.securitySafetyStatus === "blocked" ||
    input.hardeningStatus === "blocked"
  ) {
    return "blocked";
  }

  if (
    input.warningModules > 0 ||
    input.runtimeIntegrityStatus === "warning" ||
    input.dataSafetyStatus === "warning" ||
    input.securitySafetyStatus === "warning" ||
    input.hardeningStatus === "warning"
  ) {
    return "warning";
  }

  const certified =
    input.readOnlyStatus === "certified" &&
    input.mutationSafetyStatus === "certified" &&
    input.executionSafetyStatus === "certified" &&
    input.dataSafetyStatus === "certified" &&
    input.securitySafetyStatus === "certified" &&
    input.runtimeIntegrityStatus === "certified" &&
    input.hardeningStatus === "certified" &&
    input.stressStable &&
    input.finalValidationStable;

  return certified ? "final_production_certified" : "review_required";
}

function buildFinalCertificationItem(
  definition: FinalScopeDefinition,
  input: SupportFinalProductionCertificationInput
): SupportFinalProductionCertificationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const productionCertificationItem = definition.productionCertificationKey
    ? input.productionCertificationItems.find(
        (item) => item.productionCertificationKey === definition.productionCertificationKey
      ) ?? null
    : null;
  const runtimeCertificationItem = definition.runtimeCertificationKey
    ? input.runtimeCertificationItems.find(
        (item) => item.runtimeCertificationKey === definition.runtimeCertificationKey
      ) ?? null
    : null;
  const dataCertificationItem = definition.dataCertificationKey
    ? input.dataCertificationItems.find((item) => item.certificationKey === definition.dataCertificationKey) ?? null
    : null;
  const securityCertificationItem = definition.securityCertificationKey
    ? input.securityCertificationItems.find(
        (item) => item.securityCertificationKey === definition.securityCertificationKey
      ) ?? null
    : null;
  const hardeningItem = definition.hardeningGroupKey
    ? input.productionHardeningItems.find((item) => item.groupKey === definition.hardeningGroupKey) ?? null
    : null;
  const stressItem = definition.stressValidationGroupKey
    ? input.stressValidationItems.find((item) => item.groupKey === definition.stressValidationGroupKey) ?? null
    : null;
  const finalValidationItem = definition.finalValidationGroupKey
    ? input.finalValidationItems.find((item) => item.groupKey === definition.finalValidationGroupKey) ?? null
    : null;
  const moduleCounts =
    definition.groupKey === "data-final-certification"
      ? {
          blockedModules: input.dataCertification.blockedScopes,
          certifiedModules: input.dataCertification.certifiedScopes,
          warningModules: input.dataCertification.warningScopes
        }
      : definition.groupKey === "security-final-certification"
        ? {
            blockedModules: input.securityCertification.blockedScopes,
            certifiedModules: input.securityCertification.certifiedScopes,
            warningModules: input.securityCertification.warningScopes
          }
        : definition.groupKey === "runtime-final-certification"
          ? {
              blockedModules: input.runtimeCertification.blockedScopes,
              certifiedModules: input.runtimeCertification.certifiedScopes,
              warningModules: input.runtimeCertification.warningScopes
            }
          : definition.groupKey === "production-final-certification"
            ? {
                blockedModules: input.productionCertification.blockedScopes,
                certifiedModules: input.productionCertification.productionReadyScopes,
                warningModules: input.productionCertification.warningScopes
              }
            : definition.groupKey === "stress-validation-final-certification"
              ? {
                  blockedModules: input.stressValidation.blockedScopes,
                  certifiedModules: input.stressValidation.stableScopes,
                  warningModules: input.stressValidation.warningScopes
                }
              : definition.groupKey === "hardening-final-certification"
                ? {
                    blockedModules: input.productionHardening.blockedScopes,
                    certifiedModules: input.productionHardening.hardenedScopes,
                    warningModules: input.productionHardening.warningScopes
                  }
                : definition.groupKey === "final-validation-final-certification"
                  ? {
                      blockedModules: input.finalValidation.blockedScopes,
                      certifiedModules: input.finalValidation.validatedScopes,
                      warningModules: input.finalValidation.warningScopes
                    }
                  : collectModuleCounts(input, definition.registryKeys);
  const readOnlyStatus = !runtimeShapeValid
    ? "review_required"
    : isMetaCertificationScope(definition.groupKey)
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "readOnlyStatus");
  const mutationSafetyStatus = !runtimeShapeValid
    ? "review_required"
    : isMetaCertificationScope(definition.groupKey)
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "mutationSafetyStatus");
  const executionSafetyStatus = !runtimeShapeValid
    ? "review_required"
    : isMetaCertificationScope(definition.groupKey)
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "executionSafetyStatus");
  const dataSafetyStatus = isMetaCertificationScope(definition.groupKey)
    ? runtimeShapeValid
      ? "certified"
      : "review_required"
    : mapDataSafetyStatus(dataCertificationItem);
  const securitySafetyStatus =
    definition.groupKey === "security-final-certification" || isMetaCertificationScope(definition.groupKey)
      ? runtimeShapeValid
        ? "certified"
        : "review_required"
      : mapSecurityStatus(securityCertificationItem);
  const runtimeIntegrityStatus = !runtimeShapeValid
    ? "review_required"
    : isMetaCertificationScope(definition.groupKey)
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "runtimeIntegrityStatus");
  const hardeningStatus =
    definition.groupKey === "hardening-final-certification"
      ? runtimeShapeValid && input.productionHardening.overallStatus === "support_production_hardening_ready"
        ? "certified"
        : "review_required"
      : mapHardeningStatus(hardeningItem);
  const stressStable =
    definition.groupKey === "stress-validation-final-certification"
      ? runtimeShapeValid && input.stressValidation.overallStatus === "support_stress_validation_ready"
      : stressItem
        ? isSupportStressScopeStable(stressItem)
        : true;
  const finalValidationStable =
    definition.groupKey === "final-validation-final-certification"
      ? runtimeShapeValid && input.finalValidation.overallStatus === "support_final_validation_ready"
      : finalValidationItem
        ? isSupportFinalValidationScopePassed(finalValidationItem)
        : true;
  const finalProductionStatus = resolveFinalProductionStatus({
    blockedModules: moduleCounts.blockedModules,
    dataSafetyStatus,
    executionSafetyStatus,
    finalValidationStable,
    hardeningStatus,
    mutationSafetyStatus,
    readOnlyStatus,
    runtimeIntegrityStatus,
    runtimeShapeValid,
    securitySafetyStatus,
    stressStable,
    warningModules: moduleCounts.warningModules
  });

  return {
    blockedModules: moduleCounts.blockedModules,
    certificationName: definition.certificationName,
    certificationScope: definition.certificationScope,
    certifiedModules: moduleCounts.certifiedModules,
    dataSafetyStatus,
    executionSafetyStatus,
    finalCertificationKey: `sp-final-cert-${definition.groupKey}`,
    finalProductionStatus,
    groupKey: definition.groupKey,
    hardeningStatus,
    mutationSafetyStatus,
    readOnlyStatus,
    runtimeIntegrityStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `guarantee ${definition.finalGuarantee}`,
      `final ${finalProductionStatus}`,
      `integrity ${runtimeIntegrityStatus}`,
      `read only ${readOnlyStatus}`,
      `hardening ${hardeningStatus}`,
      `data ${dataSafetyStatus}`,
      `security ${securitySafetyStatus}`,
      `${moduleCounts.certifiedModules} certified modules`,
      `${moduleCounts.blockedModules} blocked`,
      `${moduleCounts.warningModules} warning`
    ].join("; "),
    securitySafetyStatus,
    warningModules: moduleCounts.warningModules
  };
}

export function isSupportFinalScopeCertified(item: SupportFinalProductionCertificationItem) {
  return item.finalProductionStatus === "final_production_certified";
}

export function buildSupportFinalProductionCertificationGroups(items: SupportFinalProductionCertificationItem[]) {
  return FINAL_GROUP_DEFINITIONS.map((definition) => {
    const groupItems = items.filter((item) => item.groupKey === definition.groupKey);

    return {
      groupKey: definition.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: definition.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getSupportFinalProductionCertificationSummary(
  items: SupportFinalProductionCertificationItem[]
): SupportFinalProductionCertificationSummary {
  const registryEntry = getSupportRegistryEntry("sp-final-production-certification");
  const certifiedScopes = items.filter((item) => isSupportFinalScopeCertified(item)).length;
  const reviewRequiredScopes = items.filter((item) => item.finalProductionStatus === "review_required").length;
  const blockedScopes = items.filter((item) => item.finalProductionStatus === "blocked").length;
  const warningScopes = items.filter((item) => item.finalProductionStatus === "warning").length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0 || !registryEntry?.productionReady
      ? ("needs_attention" as const)
      : ("support_final_production_certification_ready" as const);

  return {
    blockedScopes,
    certifiedScopes,
    groupCount: buildSupportFinalProductionCertificationGroups(items).length,
    overallStatus,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    reviewRequiredScopes,
    source: SUPPORT_FINAL_PRODUCTION_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} final certifications`,
      `${certifiedScopes} final production certified`,
      `${reviewRequiredScopes} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`,
      registryEntry?.productionReady ? "registry production_ready" : "registry pending"
    ].join("; "),
    totalCertifications: items.length,
    warningScopes
  };
}

export function supportFinalCertificationStatusLabel(status: SupportFinalCertificationStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "certified":
      return "Certified";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function supportFinalProductionStatusLabel(status: SupportFinalProductionStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "final_production_certified":
      return "Final Production Certified";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function supportFinalCertificationStatusTone(
  status: SupportFinalCertificationStatus | SupportFinalProductionStatus
) {
  switch (status) {
    case "certified":
    case "final_production_certified":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function supportFinalProductionCertificationRuntimeStatusBadgeTone(
  status: SupportFinalProductionCertificationSummary["overallStatus"]
): "amber" | "green" {
  return status === "support_final_production_certification_ready" ? "green" : "amber";
}

export function buildSupportFinalProductionCertificationReadOnlySafe(
  input: SupportFinalProductionCertificationInput
) {
  const finalCertificationItems = FINAL_SCOPE_DEFINITIONS.map((definition) =>
    buildFinalCertificationItem(definition, input)
  );
  const groups = buildSupportFinalProductionCertificationGroups(finalCertificationItems);
  const summary = getSupportFinalProductionCertificationSummary(finalCertificationItems);

  return {
    finalCertification: summary,
    finalCertificationGroups: groups,
    finalCertificationItems,
    finalCertificationSafeControls: buildSafeControls()
  };
}

export function mapSupportFinalProductionCertificationToAdminFields(
  input: ReturnType<typeof buildSupportFinalProductionCertificationReadOnlySafe>
) {
  return input;
}
