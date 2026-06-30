import "server-only";

import type {
  SupportDataCertificationItem,
  SupportDataCertificationSummary
} from "@/src/lib/support/support-data-certification-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type {
  SupportRuntimeCertificationItem,
  SupportRuntimeCertificationSummary
} from "@/src/lib/support/support-runtime-certification-runtime";
import type { SupportReviewRuntimeItem } from "@/src/lib/support/support-review-runtime";
import type {
  SupportSecurityCertificationItem,
  SupportSecurityCertificationSummary
} from "@/src/lib/support/support-security-certification-runtime";
import type { SupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";

export type SupportProductionCertificationSource = "support_production_certification_runtime";

export type SupportProductionCertificationGroupKey =
  | "analytics-export-production-certification"
  | "data-certification-review"
  | "discovery-production-certification"
  | "events-production-certification"
  | "governance-production-certification"
  | "platform-production-certification"
  | "runtime-certification-review"
  | "security-certification-review"
  | "tickets-production-certification";

export type SupportProductionCertificationStatus = "blocked" | "certified" | "review_required" | "warning";

export type SupportProductionReadinessStatus = "blocked" | "production_ready" | "review_required" | "warning";

export type SupportProductionCertificationLoadingState =
  | "certified"
  | "empty"
  | "error"
  | "restricted"
  | "unauthorized";

export type SupportProductionCertificationSafeControlKey =
  | "approve_production_certification"
  | "export_production_report"
  | "mark_production_certified"
  | "recheck_production_readiness"
  | "resolve_production_blocker";

export type SupportProductionCertificationSafeControl = {
  enabled: false;
  key: SupportProductionCertificationSafeControlKey;
  label: string;
  note: string;
};

export type SupportProductionCertificationItem = {
  blockedModules: number;
  certificationName: string;
  certificationScope: string;
  certifiedModules: number;
  dataSafetyStatus: SupportProductionCertificationStatus;
  executionSafetyStatus: SupportProductionCertificationStatus;
  groupKey: SupportProductionCertificationGroupKey;
  mutationSafetyStatus: SupportProductionCertificationStatus;
  productionCertificationKey: string;
  productionReadinessStatus: SupportProductionReadinessStatus;
  readOnlyStatus: SupportProductionCertificationStatus;
  runtimeIntegrityStatus: SupportProductionCertificationStatus;
  safeControls: SupportProductionCertificationSafeControl[];
  safeSummary: string;
  securitySafetyStatus: SupportProductionCertificationStatus;
  warningModules: number;
};

export type SupportProductionCertificationGroup = {
  groupKey: SupportProductionCertificationGroupKey;
  itemCount: number;
  items: SupportProductionCertificationItem[];
  title: string;
};

export type SupportProductionCertificationSummary = {
  blockedScopes: number;
  emptyMessage: string | null;
  groupCount: number;
  loadError: string | null;
  loadingState: SupportProductionCertificationLoadingState;
  overallStatus: "needs_attention" | "support_production_certification_ready";
  productionReadyScopes: number;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  reviewRequiredScopes: number;
  source: SupportProductionCertificationSource;
  summary: string;
  totalCertifications: number;
  unauthorizedMessage: string | null;
  warningScopes: number;
};

export type SupportProductionCertificationRuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

export type SupportProductionCertificationAuthorization = {
  canViewProductionCertification: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportProductionCertificationInput = {
  analyticsRuntime: SupportProductionCertificationRuntimeSnapshot;
  auditRuntime: SupportProductionCertificationRuntimeSnapshot;
  authorization: SupportProductionCertificationAuthorization;
  dashboardRuntime: SupportProductionCertificationRuntimeSnapshot;
  dataCertification: SupportDataCertificationSummary;
  dataCertificationItems: SupportDataCertificationItem[];
  errorEventsRuntime: SupportProductionCertificationRuntimeSnapshot;
  eventTimelineRuntime: SupportProductionCertificationRuntimeSnapshot;
  exportRuntime: SupportProductionCertificationRuntimeSnapshot;
  filtersRuntime: SupportProductionCertificationRuntimeSnapshot;
  hiddenRecordCount?: number;
  loadError?: string | null;
  metricsRuntime: SupportProductionCertificationRuntimeSnapshot;
  monitoringEventsRuntime: SupportProductionCertificationRuntimeSnapshot;
  notificationsRuntime: SupportProductionCertificationRuntimeSnapshot;
  registryRuntime: SupportProductionCertificationRuntimeSnapshot;
  restrictedRecordCount?: number;
  reviewItems: Array<Pick<SupportReviewRuntimeItem, "registryKey" | "reviewStatus" | "safeSummary">>;
  reviewRuntime: SupportProductionCertificationRuntimeSnapshot;
  role: "internal_team" | "super_admin";
  runtimeCertification: SupportRuntimeCertificationSummary;
  runtimeCertificationItems: SupportRuntimeCertificationItem[];
  safeActionsRuntime: SupportProductionCertificationRuntimeSnapshot;
  searchRuntime: SupportProductionCertificationRuntimeSnapshot;
  securityCertification: SupportSecurityCertificationSummary;
  securityCertificationItems: SupportSecurityCertificationItem[];
  statusRuntime: SupportProductionCertificationRuntimeSnapshot;
  ticketAssignmentRuntime: SupportProductionCertificationRuntimeSnapshot;
  ticketConversationRuntime: SupportProductionCertificationRuntimeSnapshot;
  ticketDetailsRuntime: SupportProductionCertificationRuntimeSnapshot;
  ticketStatusRuntime: SupportProductionCertificationRuntimeSnapshot;
  ticketsRuntime: SupportProductionCertificationRuntimeSnapshot;
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibilityRuntime: SupportProductionCertificationRuntimeSnapshot;
};

type ProductionScopeDefinition = {
  certificationName: string;
  certificationScope: string;
  dataCertificationKey: string | null;
  derivedOnly: boolean;
  expectedSources: readonly string[];
  groupKey: SupportProductionCertificationGroupKey;
  productionGuarantee: string;
  registryKeys: readonly string[];
  resolveRuntimeSnapshots: (input: SupportProductionCertificationInput) => SupportProductionCertificationRuntimeSnapshot[];
  runtimeCertificationKey: string | null;
};

export const SUPPORT_PRODUCTION_CERTIFICATION_SOURCE = "support_production_certification_runtime" as const;

export const SUPPORT_PRODUCTION_CERTIFICATION_SAFE_CONTROLS: readonly SupportProductionCertificationSafeControl[] = [
  {
    enabled: false,
    key: "approve_production_certification",
    label: "Approve Production Certification",
    note: "Read-only placeholder. No production certification approval or mutation runs during SP-25 page load."
  },
  {
    enabled: false,
    key: "recheck_production_readiness",
    label: "Recheck Production Readiness",
    note: "Read-only placeholder. No production recheck execution or data mutation runs during SP-25 page load."
  },
  {
    enabled: false,
    key: "export_production_report",
    label: "Export Production Report",
    note: "Read-only placeholder. No production export runs during SP-25 page load."
  },
  {
    enabled: false,
    key: "resolve_production_blocker",
    label: "Resolve Production Blocker",
    note: "Read-only placeholder. No production blocker resolve action runs during SP-25 page load."
  },
  {
    enabled: false,
    key: "mark_production_certified",
    label: "Mark Production Certified",
    note: "Read-only placeholder. No production certification record write runs during SP-25 page load."
  }
] as const;

const PRODUCTION_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportProductionCertificationGroupKey;
  title: string;
}> = [
  { groupKey: "platform-production-certification", title: "Platform Production Certification" },
  { groupKey: "tickets-production-certification", title: "Tickets Production Certification" },
  { groupKey: "events-production-certification", title: "Events Production Certification" },
  { groupKey: "discovery-production-certification", title: "Discovery Production Certification" },
  { groupKey: "governance-production-certification", title: "Governance Production Certification" },
  { groupKey: "analytics-export-production-certification", title: "Analytics & Export Production Certification" },
  { groupKey: "data-certification-review", title: "Data Certification Review" },
  { groupKey: "security-certification-review", title: "Security Certification Review" },
  { groupKey: "runtime-certification-review", title: "Runtime Certification Review" }
];

const PRODUCTION_SCOPE_DEFINITIONS: readonly ProductionScopeDefinition[] = [
  {
    certificationName: "Support Registry Production Certification",
    certificationScope: "SP-1 Support Registry is stable and production-safe for Super Admin",
    dataCertificationKey: "sp-cert-registry-data",
    derivedOnly: false,
    expectedSources: [SUPPORT_REGISTRY_SOURCE],
    groupKey: "platform-production-certification",
    productionGuarantee: "Support Registry is stable",
    registryKeys: [],
    runtimeCertificationKey: "sp-runtime-sp-cert-registry-data",
    resolveRuntimeSnapshots: (input) => [input.registryRuntime]
  },
  {
    certificationName: "Support Dashboard Production Certification",
    certificationScope: "SP-2 Support Dashboard is derived and production-safe for Super Admin",
    dataCertificationKey: "sp-cert-dashboard-data",
    derivedOnly: true,
    expectedSources: ["support_dashboard_runtime"],
    groupKey: "platform-production-certification",
    productionGuarantee: "Support Dashboard is derived only",
    registryKeys: ["sp-dashboard"],
    runtimeCertificationKey: "sp-runtime-sp-cert-dashboard-data",
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime]
  },
  {
    certificationName: "Tickets Production Certification",
    certificationScope: "SP-3 Support Tickets runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-tickets-data",
    derivedOnly: false,
    expectedSources: ["support_tickets_runtime"],
    groupKey: "tickets-production-certification",
    productionGuarantee: "Support Tickets are read-only on page load",
    registryKeys: ["sp-tickets"],
    runtimeCertificationKey: "sp-runtime-sp-cert-tickets-data",
    resolveRuntimeSnapshots: (input) => [input.ticketsRuntime]
  },
  {
    certificationName: "Ticket Details Production Certification",
    certificationScope: "SP-4 Support Ticket Details runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-ticket-details-data",
    derivedOnly: false,
    expectedSources: ["support_ticket_details_runtime"],
    groupKey: "tickets-production-certification",
    productionGuarantee: "Support Ticket Details are read-only on page load",
    registryKeys: ["sp-ticket-details"],
    runtimeCertificationKey: "sp-runtime-sp-cert-ticket-details-data",
    resolveRuntimeSnapshots: (input) => [input.ticketDetailsRuntime]
  },
  {
    certificationName: "Ticket Status Production Certification",
    certificationScope: "SP-5 Support Ticket Status runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-ticket-status-data",
    derivedOnly: false,
    expectedSources: ["support_ticket_status_runtime"],
    groupKey: "tickets-production-certification",
    productionGuarantee: "Support Ticket Status is read-only on page load",
    registryKeys: ["sp-ticket-status"],
    runtimeCertificationKey: "sp-runtime-sp-cert-ticket-status-data",
    resolveRuntimeSnapshots: (input) => [input.ticketStatusRuntime]
  },
  {
    certificationName: "Ticket Assignment Production Certification",
    certificationScope: "SP-6 Support Ticket Assignment runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-ticket-assignment-data",
    derivedOnly: false,
    expectedSources: ["support_ticket_assignment_runtime"],
    groupKey: "tickets-production-certification",
    productionGuarantee: "Support Ticket Assignment is read-only on page load",
    registryKeys: ["sp-ticket-assignment"],
    runtimeCertificationKey: "sp-runtime-sp-cert-ticket-assignment-data",
    resolveRuntimeSnapshots: (input) => [input.ticketAssignmentRuntime]
  },
  {
    certificationName: "Ticket Conversation Production Certification",
    certificationScope: "SP-7 Support Ticket Conversation runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-ticket-conversation-data",
    derivedOnly: false,
    expectedSources: ["support_ticket_conversation_runtime"],
    groupKey: "tickets-production-certification",
    productionGuarantee: "Support Ticket Conversation is read-only on page load",
    registryKeys: ["sp-ticket-conversation"],
    runtimeCertificationKey: "sp-runtime-sp-cert-ticket-conversation-data",
    resolveRuntimeSnapshots: (input) => [input.ticketConversationRuntime]
  },
  {
    certificationName: "Monitoring Events Production Certification",
    certificationScope: "SP-8 Support Monitoring Events runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-monitoring-events-data",
    derivedOnly: false,
    expectedSources: ["support_monitoring_events_runtime"],
    groupKey: "events-production-certification",
    productionGuarantee: "Support Monitoring Events are read-only on page load",
    registryKeys: ["sp-monitoring-events"],
    runtimeCertificationKey: "sp-runtime-sp-cert-monitoring-events-data",
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime]
  },
  {
    certificationName: "Error Events Production Certification",
    certificationScope: "SP-9 Support Error Events runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-error-events-data",
    derivedOnly: false,
    expectedSources: ["support_error_events_runtime"],
    groupKey: "events-production-certification",
    productionGuarantee: "Support Error Events are read-only on page load",
    registryKeys: ["sp-error-events"],
    runtimeCertificationKey: "sp-runtime-sp-cert-error-events-data",
    resolveRuntimeSnapshots: (input) => [input.errorEventsRuntime]
  },
  {
    certificationName: "Event Timeline Production Certification",
    certificationScope: "SP-10 Support Event Timeline runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-event-timeline-data",
    derivedOnly: false,
    expectedSources: ["support_event_timeline_runtime"],
    groupKey: "events-production-certification",
    productionGuarantee: "Support Event Timeline is read-only on page load",
    registryKeys: ["sp-event-timeline"],
    runtimeCertificationKey: "sp-runtime-sp-cert-event-timeline-data",
    resolveRuntimeSnapshots: (input) => [input.eventTimelineRuntime]
  },
  {
    certificationName: "Search Production Certification",
    certificationScope: "SP-11 Support Search runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-search-data",
    derivedOnly: true,
    expectedSources: ["support_search_runtime"],
    groupKey: "discovery-production-certification",
    productionGuarantee: "Support Search is read-only on page load",
    registryKeys: ["sp-search"],
    runtimeCertificationKey: "sp-runtime-sp-cert-search-data",
    resolveRuntimeSnapshots: (input) => [input.searchRuntime]
  },
  {
    certificationName: "Filters Production Certification",
    certificationScope: "SP-12 Support Filters runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-filters-data",
    derivedOnly: true,
    expectedSources: ["support_filters_runtime"],
    groupKey: "discovery-production-certification",
    productionGuarantee: "Support Filters are read-only on page load",
    registryKeys: ["sp-filters"],
    runtimeCertificationKey: "sp-runtime-sp-cert-filters-data",
    resolveRuntimeSnapshots: (input) => [input.filtersRuntime]
  },
  {
    certificationName: "Metrics Production Certification",
    certificationScope: "SP-13 Support Metrics runtime is derived and production-safe",
    dataCertificationKey: "sp-cert-metrics-data",
    derivedOnly: true,
    expectedSources: ["support_metrics_runtime"],
    groupKey: "discovery-production-certification",
    productionGuarantee: "Support Metrics are derived only",
    registryKeys: ["sp-metrics"],
    runtimeCertificationKey: "sp-runtime-sp-cert-metrics-data",
    resolveRuntimeSnapshots: (input) => [input.metricsRuntime]
  },
  {
    certificationName: "Visibility Production Certification",
    certificationScope: "SP-14 Support Visibility runtime is derived and production-safe",
    dataCertificationKey: "sp-cert-visibility-data",
    derivedOnly: true,
    expectedSources: ["support_visibility_runtime"],
    groupKey: "governance-production-certification",
    productionGuarantee: "Support Visibility is derived only",
    registryKeys: ["sp-visibility"],
    runtimeCertificationKey: "sp-runtime-sp-cert-visibility-data",
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime]
  },
  {
    certificationName: "Safe Actions Production Certification",
    certificationScope: "SP-15 Support Safe Actions are explicit and Super Admin only",
    dataCertificationKey: "sp-cert-safe-actions-data",
    derivedOnly: false,
    expectedSources: ["support_safe_actions_runtime"],
    groupKey: "governance-production-certification",
    productionGuarantee: "Support Safe Actions require explicit authorization",
    registryKeys: ["sp-safe-actions"],
    runtimeCertificationKey: "sp-runtime-sp-cert-safe-actions-data",
    resolveRuntimeSnapshots: (input) => [input.safeActionsRuntime]
  },
  {
    certificationName: "Audit Production Certification",
    certificationScope: "SP-16 Support Audit runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-audit-data",
    derivedOnly: true,
    expectedSources: ["support_audit_runtime"],
    groupKey: "governance-production-certification",
    productionGuarantee: "Support Audit is read-only on page load",
    registryKeys: ["sp-audit"],
    runtimeCertificationKey: "sp-runtime-sp-cert-audit-data",
    resolveRuntimeSnapshots: (input) => [input.auditRuntime]
  },
  {
    certificationName: "Review Production Certification",
    certificationScope: "SP-17 Support Review runtime is derived and production-safe",
    dataCertificationKey: "sp-cert-review-data",
    derivedOnly: true,
    expectedSources: ["support_review_runtime"],
    groupKey: "governance-production-certification",
    productionGuarantee: "Support Review is derived only",
    registryKeys: ["sp-review"],
    runtimeCertificationKey: "sp-runtime-sp-cert-review-data",
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime]
  },
  {
    certificationName: "Notifications Production Certification",
    certificationScope: "SP-18 Support Notifications runtime is read-only and production-safe",
    dataCertificationKey: "sp-cert-notifications-data",
    derivedOnly: true,
    expectedSources: ["support_notifications_runtime"],
    groupKey: "governance-production-certification",
    productionGuarantee: "Support Notifications are read-only on page load",
    registryKeys: ["sp-notifications"],
    runtimeCertificationKey: "sp-runtime-sp-cert-notifications-data",
    resolveRuntimeSnapshots: (input) => [input.notificationsRuntime]
  },
  {
    certificationName: "Analytics Production Certification",
    certificationScope: "SP-19 Support Analytics runtime is derived and production-safe",
    dataCertificationKey: "sp-cert-analytics-data",
    derivedOnly: true,
    expectedSources: ["support_analytics_runtime"],
    groupKey: "analytics-export-production-certification",
    productionGuarantee: "Support Analytics are derived only",
    registryKeys: ["sp-analytics"],
    runtimeCertificationKey: "sp-runtime-sp-cert-analytics-data",
    resolveRuntimeSnapshots: (input) => [input.analyticsRuntime]
  },
  {
    certificationName: "Export Production Certification",
    certificationScope: "SP-20 Support Export is explicit download only and production-safe",
    dataCertificationKey: "sp-cert-export-data",
    derivedOnly: false,
    expectedSources: ["support_export_runtime"],
    groupKey: "analytics-export-production-certification",
    productionGuarantee: "Support Export is explicit download only",
    registryKeys: ["sp-export"],
    runtimeCertificationKey: "sp-runtime-sp-cert-export-data",
    resolveRuntimeSnapshots: (input) => [input.exportRuntime]
  },
  {
    certificationName: "Status Production Certification",
    certificationScope: "SP-21 Support Status runtime is derived and production-safe",
    dataCertificationKey: "sp-cert-status-data",
    derivedOnly: true,
    expectedSources: ["support_status_runtime"],
    groupKey: "analytics-export-production-certification",
    productionGuarantee: "Support Status is derived only",
    registryKeys: ["sp-status"],
    runtimeCertificationKey: "sp-runtime-sp-cert-status-data",
    resolveRuntimeSnapshots: (input) => [input.statusRuntime]
  },
  {
    certificationName: "Data Certification Review",
    certificationScope: "SP-22 Support Data Certification is read-only and production-safe",
    dataCertificationKey: null,
    derivedOnly: false,
    expectedSources: ["support_data_certification_runtime"],
    groupKey: "data-certification-review",
    productionGuarantee: "Support Data Certification is read-only",
    registryKeys: ["sp-data-certification"],
    runtimeCertificationKey: "sp-runtime-data-certification-review",
    resolveRuntimeSnapshots: (input) => [input.dataCertification]
  },
  {
    certificationName: "Security Certification Review",
    certificationScope: "SP-23 Support Security Certification is read-only and production-safe",
    dataCertificationKey: null,
    derivedOnly: false,
    expectedSources: ["support_security_certification_runtime"],
    groupKey: "security-certification-review",
    productionGuarantee: "Support Security Certification is read-only",
    registryKeys: ["sp-security-certification"],
    runtimeCertificationKey: "sp-runtime-security-certification-review",
    resolveRuntimeSnapshots: (input) => [input.securityCertification]
  },
  {
    certificationName: "Runtime Certification Review",
    certificationScope: "SP-24 Support Runtime Certification is read-only and production-safe",
    dataCertificationKey: null,
    derivedOnly: false,
    expectedSources: ["support_runtime_certification_runtime"],
    groupKey: "runtime-certification-review",
    productionGuarantee: "Support Runtime Certification is read-only",
    registryKeys: ["sp-runtime-certification"],
    runtimeCertificationKey: null,
    resolveRuntimeSnapshots: (input) => [input.runtimeCertification]
  }
] as const;

function buildSafeControls() {
  return SUPPORT_PRODUCTION_CERTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectRegistryCounts(input: SupportProductionCertificationInput, registryKeys: readonly string[]) {
  const reviewItems = input.reviewItems.filter((item) => registryKeys.includes(item.registryKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    certifiedModules: reviewItems.filter((item) => item.reviewStatus === "clear").length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function validateRuntimeShape(
  snapshots: SupportProductionCertificationRuntimeSnapshot[],
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

function mapDataSafetyStatus(item: SupportDataCertificationItem | null): SupportProductionCertificationStatus {
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
    "dataSafetyStatus" | "executionSafetyStatus" | "mutationSafetyStatus" | "readOnlyStatus" | "runtimeIntegrityStatus" | "securitySafetyStatus" | "stateSafetyStatus"
  >
): SupportProductionCertificationStatus {
  if (!item) {
    return "review_required";
  }

  return item[field];
}

function resolveProductionReadinessStatus(input: {
  blockedModules: number;
  dataSafetyStatus: SupportProductionCertificationStatus;
  executionSafetyStatus: SupportProductionCertificationStatus;
  mutationSafetyStatus: SupportProductionCertificationStatus;
  readOnlyStatus: SupportProductionCertificationStatus;
  runtimeIntegrityStatus: SupportProductionCertificationStatus;
  runtimeShapeValid: boolean;
  securitySafetyStatus: SupportProductionCertificationStatus;
  stateSafetyStatus: SupportProductionCertificationStatus;
  warningModules: number;
}): SupportProductionReadinessStatus {
  if (
    !input.runtimeShapeValid ||
    input.blockedModules > 0 ||
    input.runtimeIntegrityStatus === "blocked" ||
    input.dataSafetyStatus === "blocked" ||
    input.securitySafetyStatus === "blocked" ||
    input.stateSafetyStatus === "blocked"
  ) {
    return "blocked";
  }

  if (
    input.warningModules > 0 ||
    input.runtimeIntegrityStatus === "warning" ||
    input.dataSafetyStatus === "warning" ||
    input.securitySafetyStatus === "warning" ||
    input.stateSafetyStatus === "warning"
  ) {
    return "warning";
  }

  const ready =
    input.readOnlyStatus === "certified" &&
    input.mutationSafetyStatus === "certified" &&
    input.executionSafetyStatus === "certified" &&
    input.dataSafetyStatus === "certified" &&
    input.securitySafetyStatus === "certified" &&
    input.runtimeIntegrityStatus === "certified" &&
    input.stateSafetyStatus === "certified";

  return ready ? "production_ready" : "review_required";
}

function buildProductionCertificationItem(
  definition: ProductionScopeDefinition,
  input: SupportProductionCertificationInput
): SupportProductionCertificationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const runtimeCertificationItem = definition.runtimeCertificationKey
    ? input.runtimeCertificationItems.find(
        (item) => item.runtimeCertificationKey === definition.runtimeCertificationKey
      ) ?? null
    : null;
  const dataCertificationItem = definition.dataCertificationKey
    ? input.dataCertificationItems.find((item) => item.certificationKey === definition.dataCertificationKey) ?? null
    : null;
  const moduleCounts =
    definition.groupKey === "data-certification-review"
      ? {
          blockedModules: input.dataCertification.blockedScopes,
          certifiedModules: input.dataCertification.certifiedScopes,
          warningModules: input.dataCertification.warningScopes
        }
      : definition.groupKey === "security-certification-review"
        ? {
            blockedModules: input.securityCertification.blockedScopes,
            certifiedModules: input.securityCertification.certifiedScopes,
            warningModules: input.securityCertification.warningScopes
          }
        : definition.groupKey === "runtime-certification-review"
          ? {
              blockedModules: input.runtimeCertification.blockedScopes,
              certifiedModules: input.runtimeCertification.certifiedScopes,
              warningModules: input.runtimeCertification.warningScopes
            }
          : collectRegistryCounts(input, definition.registryKeys);
  const readOnlyStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-certification-review"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "readOnlyStatus");
  const mutationSafetyStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-certification-review"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "mutationSafetyStatus");
  const executionSafetyStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-certification-review"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "executionSafetyStatus");
  const dataSafetyStatus =
    definition.groupKey === "data-certification-review"
      ? runtimeShapeValid
        ? "certified"
        : "review_required"
      : mapDataSafetyStatus(dataCertificationItem);
  const securitySafetyStatus =
    definition.groupKey === "security-certification-review" || definition.groupKey === "runtime-certification-review"
      ? runtimeShapeValid
        ? "certified"
        : "review_required"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "securitySafetyStatus");
  const runtimeIntegrityStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-certification-review"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "runtimeIntegrityStatus");
  const stateSafetyStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-certification-review"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "stateSafetyStatus");
  const productionReadinessStatus = resolveProductionReadinessStatus({
    blockedModules: moduleCounts.blockedModules,
    dataSafetyStatus,
    executionSafetyStatus,
    mutationSafetyStatus,
    readOnlyStatus,
    runtimeIntegrityStatus,
    runtimeShapeValid,
    securitySafetyStatus,
    stateSafetyStatus,
    warningModules: moduleCounts.warningModules
  });

  return {
    blockedModules: moduleCounts.blockedModules,
    certificationName: definition.certificationName,
    certificationScope: definition.certificationScope,
    certifiedModules: moduleCounts.certifiedModules,
    dataSafetyStatus,
    executionSafetyStatus,
    groupKey: definition.groupKey,
    mutationSafetyStatus,
    productionCertificationKey: `sp-production-${definition.dataCertificationKey ?? definition.groupKey}`,
    productionReadinessStatus,
    readOnlyStatus,
    runtimeIntegrityStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `guarantee ${definition.productionGuarantee}`,
      `production ${productionReadinessStatus}`,
      `integrity ${runtimeIntegrityStatus}`,
      `read only ${readOnlyStatus}`,
      `states ${stateSafetyStatus}`,
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

export function resolveSupportProductionCertificationAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportProductionCertificationAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewProductionCertification: true,
      reason: "Super Admin may view Support production certification through read-only runtime validation.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewProductionCertification: false,
    reason: "Support production certification is restricted to Super Admin in SP-25.",
    roleLabel: input.role
  };
}

export function supportProductionCertificationStatusLabel(status: SupportProductionCertificationStatus) {
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

export function supportProductionReadinessLabel(status: SupportProductionReadinessStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "production_ready":
      return "Production Ready";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function supportProductionCertificationStatusTone(
  status: SupportProductionCertificationStatus | SupportProductionReadinessStatus
) {
  switch (status) {
    case "certified":
    case "production_ready":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function supportProductionCertificationRuntimeStatusBadgeTone(
  status: SupportProductionCertificationSummary["overallStatus"]
): "amber" | "green" {
  return status === "support_production_certification_ready" ? "green" : "amber";
}

export function isSupportProductionScopeReady(item: SupportProductionCertificationItem) {
  return item.productionReadinessStatus === "production_ready";
}

export function buildSupportProductionCertificationGroups(
  items: SupportProductionCertificationItem[]
): SupportProductionCertificationGroup[] {
  return PRODUCTION_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

function getSupportProductionCertificationSummary(
  items: SupportProductionCertificationItem[],
  input: Pick<
    SupportProductionCertificationInput,
    "authorization" | "hiddenRecordCount" | "loadError" | "restrictedRecordCount" | "role" | "visibilityAuthorization"
  >
): SupportProductionCertificationSummary {
  const registryEntry = getSupportRegistryEntry("sp-production-certification");
  const hiddenRecordCount = input.hiddenRecordCount ?? 0;
  const restrictedRecordCount = input.restrictedRecordCount ?? 0;

  if (
    !input.authorization.canViewProductionCertification ||
    !input.visibilityAuthorization.canViewSupportData ||
    input.role !== "super_admin"
  ) {
    return {
      blockedScopes: 0,
      emptyMessage: "Support production certification is hidden for the current account.",
      groupCount: 0,
      loadError: null,
      loadingState: "unauthorized",
      overallStatus: "needs_attention",
      productionReadyScopes: 0,
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: PRODUCTION_SCOPE_DEFINITIONS.length,
      source: SUPPORT_PRODUCTION_CERTIFICATION_SOURCE,
      summary: input.authorization.reason,
      totalCertifications: PRODUCTION_SCOPE_DEFINITIONS.length,
      unauthorizedMessage:
        "Support production certification is Super Admin only. No production mutation runs during page load.",
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
      productionReadyScopes: 0,
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: items.length,
      source: SUPPORT_PRODUCTION_CERTIFICATION_SOURCE,
      summary: `status load_error; ${input.loadError}`,
      totalCertifications: items.length,
      unauthorizedMessage: null,
      warningScopes: 0
    };
  }

  const productionReadyScopes = items.filter((item) => isSupportProductionScopeReady(item)).length;
  const reviewRequiredScopes = items.filter((item) => item.productionReadinessStatus === "review_required").length;
  const blockedScopes = items.filter((item) => item.productionReadinessStatus === "blocked").length;
  const warningScopes = items.filter((item) => item.productionReadinessStatus === "warning").length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("support_production_certification_ready" as const);
  const loadingState: SupportProductionCertificationLoadingState =
    restrictedRecordCount > 0
      ? "restricted"
      : productionReadyScopes === 0
        ? "empty"
        : overallStatus === "support_production_certification_ready"
          ? "certified"
          : "restricted";

  return {
    blockedScopes,
    emptyMessage:
      productionReadyScopes === 0
        ? "No Support production scopes are fully certified for the current runtime snapshot."
        : null,
    groupCount: buildSupportProductionCertificationGroups(items).length,
    loadError: null,
    loadingState,
    overallStatus,
    productionReadyScopes,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      restrictedRecordCount > 0
        ? `${restrictedRecordCount} record(s) excluded from Support production certification under SP-14 visibility rules.`
        : null,
    reviewRequiredScopes,
    source: SUPPORT_PRODUCTION_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} production scopes`,
      `${productionReadyScopes} production ready`,
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

export function buildSupportProductionCertificationReadOnlySafe(input: SupportProductionCertificationInput) {
  const productionCertificationItems = PRODUCTION_SCOPE_DEFINITIONS.map((definition) =>
    buildProductionCertificationItem(definition, input)
  );
  const groups = buildSupportProductionCertificationGroups(productionCertificationItems);
  const productionCertification = getSupportProductionCertificationSummary(productionCertificationItems, input);

  return {
    productionCertification,
    productionCertificationGroups: groups,
    productionCertificationItems,
    productionCertificationSafeControls: buildSafeControls()
  };
}

export function mapSupportProductionCertificationToAdminFields(
  input: ReturnType<typeof buildSupportProductionCertificationReadOnlySafe>
) {
  return input;
}

export function toSupportProductionCertificationSnapshot(input: {
  readOnly?: boolean;
  source?: string;
  summary?: string;
}): SupportProductionCertificationRuntimeSnapshot {
  return {
    readOnly: input.readOnly ?? true,
    source: input.source,
    summary: input.summary
  };
}
