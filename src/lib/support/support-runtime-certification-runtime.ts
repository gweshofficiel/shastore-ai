import "server-only";

import type {
  SupportDataCertificationItem,
  SupportDataCertificationSummary
} from "@/src/lib/support/support-data-certification-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportReviewRuntimeItem } from "@/src/lib/support/support-review-runtime";
import type {
  SupportSecurityCertificationItem,
  SupportSecurityCertificationSummary
} from "@/src/lib/support/support-security-certification-runtime";
import type { SupportStatusRuntimeItem } from "@/src/lib/support/support-status-runtime";
import type { SupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";

export type SupportRuntimeCertificationSource = "support_runtime_certification_runtime";

export type SupportRuntimeCertificationGroupKey =
  | "analytics-export-runtime-certification"
  | "data-certification-review"
  | "discovery-runtime-certification"
  | "events-runtime-certification"
  | "governance-runtime-certification"
  | "platform-runtime-certification"
  | "security-certification-review"
  | "tickets-runtime-certification";

export type SupportRuntimeCertificationStatus = "blocked" | "certified" | "review_required" | "warning";

export type SupportRuntimeCertificationLoadingState =
  | "certified"
  | "empty"
  | "error"
  | "restricted"
  | "unauthorized";

export type SupportRuntimeCertificationSafeControlKey =
  | "approve_runtime_certification"
  | "export_runtime_report"
  | "mark_runtime_certified"
  | "recheck_runtime"
  | "resolve_runtime_blocker";

export type SupportRuntimeCertificationSafeControl = {
  enabled: false;
  key: SupportRuntimeCertificationSafeControlKey;
  label: string;
  note: string;
};

export type SupportRuntimeCertificationItem = {
  blockedModules: number;
  certificationName: string;
  certificationScope: string;
  certifiedModules: number;
  dataSafetyStatus: SupportRuntimeCertificationStatus;
  executionSafetyStatus: SupportRuntimeCertificationStatus;
  groupKey: SupportRuntimeCertificationGroupKey;
  mutationSafetyStatus: SupportRuntimeCertificationStatus;
  readOnlyStatus: SupportRuntimeCertificationStatus;
  runtimeCertificationKey: string;
  runtimeIntegrityStatus: SupportRuntimeCertificationStatus;
  safeControls: SupportRuntimeCertificationSafeControl[];
  safeSummary: string;
  securitySafetyStatus: SupportRuntimeCertificationStatus;
  stateSafetyStatus: SupportRuntimeCertificationStatus;
  warningModules: number;
};

export type SupportRuntimeCertificationGroup = {
  groupKey: SupportRuntimeCertificationGroupKey;
  itemCount: number;
  items: SupportRuntimeCertificationItem[];
  title: string;
};

export type SupportRuntimeCertificationSummary = {
  blockedScopes: number;
  certifiedScopes: number;
  emptyMessage: string | null;
  groupCount: number;
  loadError: string | null;
  loadingState: SupportRuntimeCertificationLoadingState;
  overallStatus: "needs_attention" | "support_runtime_certification_ready";
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  reviewRequiredScopes: number;
  source: SupportRuntimeCertificationSource;
  summary: string;
  totalCertifications: number;
  unauthorizedMessage: string | null;
  warningScopes: number;
};

export type SupportRuntimeCertificationRuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

export type SupportRuntimeCertificationAuthorization = {
  canViewRuntimeCertification: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportRuntimeCertificationInput = {
  analyticsRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  auditRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  authorization: SupportRuntimeCertificationAuthorization;
  dashboardRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  dataCertification: SupportDataCertificationSummary;
  dataCertificationItems: SupportDataCertificationItem[];
  errorEventsRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  eventTimelineRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  exportRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  filtersRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  hiddenRecordCount?: number;
  loadError?: string | null;
  metricsRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  monitoringEventsRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  notificationsRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  registryRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  restrictedRecordCount?: number;
  reviewItems: Array<Pick<SupportReviewRuntimeItem, "registryKey" | "reviewStatus" | "safeSummary">>;
  reviewRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  role: "internal_team" | "super_admin";
  safeActionsRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  searchRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  securityCertification: SupportSecurityCertificationSummary;
  securityCertificationItems: SupportSecurityCertificationItem[];
  statusItems: Array<Pick<SupportStatusRuntimeItem, "registryKey" | "safeSummary">>;
  statusRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  ticketAssignmentRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  ticketConversationRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  ticketDetailsRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  ticketStatusRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  ticketsRuntime: SupportRuntimeCertificationRuntimeSnapshot;
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibilityRuntime: SupportRuntimeCertificationRuntimeSnapshot;
};

type RuntimeScopeDefinition = {
  certificationName: string;
  certificationScope: string;
  dataCertificationKey: string | null;
  derivedOnly: boolean;
  expectedSources: readonly string[];
  groupKey: SupportRuntimeCertificationGroupKey;
  registryKeys: readonly string[];
  runtimeGuarantee: string;
  securityCertificationKey: string | null;
  resolveRuntimeSnapshots: (input: SupportRuntimeCertificationInput) => SupportRuntimeCertificationRuntimeSnapshot[];
};

export const SUPPORT_RUNTIME_CERTIFICATION_SOURCE = "support_runtime_certification_runtime" as const;

export const SUPPORT_RUNTIME_CERTIFICATION_SAFE_CONTROLS: readonly SupportRuntimeCertificationSafeControl[] = [
  {
    enabled: false,
    key: "approve_runtime_certification",
    label: "Approve Runtime Certification",
    note: "Read-only placeholder. No runtime certification approval or mutation runs during SP-24 page load."
  },
  {
    enabled: false,
    key: "recheck_runtime",
    label: "Recheck Runtime",
    note: "Read-only placeholder. No runtime recheck execution or data mutation runs during SP-24 page load."
  },
  {
    enabled: false,
    key: "export_runtime_report",
    label: "Export Runtime Report",
    note: "Read-only placeholder. No runtime export runs during SP-24 page load."
  },
  {
    enabled: false,
    key: "resolve_runtime_blocker",
    label: "Resolve Runtime Blocker",
    note: "Read-only placeholder. No runtime blocker resolve action runs during SP-24 page load."
  },
  {
    enabled: false,
    key: "mark_runtime_certified",
    label: "Mark Runtime Certified",
    note: "Read-only placeholder. No runtime certification record write runs during SP-24 page load."
  }
] as const;

const RUNTIME_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportRuntimeCertificationGroupKey;
  title: string;
}> = [
  { groupKey: "platform-runtime-certification", title: "Platform Runtime Certification" },
  { groupKey: "tickets-runtime-certification", title: "Tickets Runtime Certification" },
  { groupKey: "events-runtime-certification", title: "Events Runtime Certification" },
  { groupKey: "discovery-runtime-certification", title: "Discovery Runtime Certification" },
  { groupKey: "governance-runtime-certification", title: "Governance Runtime Certification" },
  { groupKey: "analytics-export-runtime-certification", title: "Analytics & Export Runtime Certification" },
  { groupKey: "data-certification-review", title: "Data Certification Review" },
  { groupKey: "security-certification-review", title: "Security Certification Review" }
];

const RUNTIME_SCOPE_DEFINITIONS: readonly RuntimeScopeDefinition[] = [
  {
    certificationName: "Support Registry Runtime Certification",
    certificationScope: "SP-1 Support Registry runtime exists and remains read-only",
    dataCertificationKey: "sp-cert-registry-data",
    derivedOnly: false,
    expectedSources: [SUPPORT_REGISTRY_SOURCE],
    groupKey: "platform-runtime-certification",
    registryKeys: [],
    runtimeGuarantee: "registry exists",
    securityCertificationKey: "sp-sec-sp-cert-registry-data",
    resolveRuntimeSnapshots: (input) => [input.registryRuntime]
  },
  {
    certificationName: "Support Dashboard Runtime Certification",
    certificationScope: "SP-2 Support Dashboard runtime derives from visible Support metadata only",
    dataCertificationKey: "sp-cert-dashboard-data",
    derivedOnly: true,
    expectedSources: ["support_dashboard_runtime"],
    groupKey: "platform-runtime-certification",
    registryKeys: ["sp-dashboard"],
    runtimeGuarantee: "dashboard derives from visible runtime data",
    securityCertificationKey: "sp-sec-sp-cert-dashboard-data",
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime]
  },
  {
    certificationName: "Tickets Runtime Certification",
    certificationScope: "SP-3 Support Tickets runtime is read-only on page load",
    dataCertificationKey: "sp-cert-tickets-data",
    derivedOnly: false,
    expectedSources: ["support_tickets_runtime"],
    groupKey: "tickets-runtime-certification",
    registryKeys: ["sp-tickets"],
    runtimeGuarantee: "tickets are read-only",
    securityCertificationKey: "sp-sec-sp-cert-tickets-data",
    resolveRuntimeSnapshots: (input) => [input.ticketsRuntime]
  },
  {
    certificationName: "Ticket Details Runtime Certification",
    certificationScope: "SP-4 Support Ticket Details runtime is read-only on page load",
    dataCertificationKey: "sp-cert-ticket-details-data",
    derivedOnly: false,
    expectedSources: ["support_ticket_details_runtime"],
    groupKey: "tickets-runtime-certification",
    registryKeys: ["sp-ticket-details"],
    runtimeGuarantee: "ticket details are read-only",
    securityCertificationKey: "sp-sec-sp-cert-ticket-details-data",
    resolveRuntimeSnapshots: (input) => [input.ticketDetailsRuntime]
  },
  {
    certificationName: "Ticket Status Runtime Certification",
    certificationScope: "SP-5 Support Ticket Status runtime is read-only on page load",
    dataCertificationKey: "sp-cert-ticket-status-data",
    derivedOnly: false,
    expectedSources: ["support_ticket_status_runtime"],
    groupKey: "tickets-runtime-certification",
    registryKeys: ["sp-ticket-status"],
    runtimeGuarantee: "ticket status is read-only on page load",
    securityCertificationKey: "sp-sec-sp-cert-ticket-status-data",
    resolveRuntimeSnapshots: (input) => [input.ticketStatusRuntime]
  },
  {
    certificationName: "Ticket Assignment Runtime Certification",
    certificationScope: "SP-6 Support Ticket Assignment runtime is read-only on page load",
    dataCertificationKey: "sp-cert-ticket-assignment-data",
    derivedOnly: false,
    expectedSources: ["support_ticket_assignment_runtime"],
    groupKey: "tickets-runtime-certification",
    registryKeys: ["sp-ticket-assignment"],
    runtimeGuarantee: "ticket assignment is read-only on page load",
    securityCertificationKey: "sp-sec-sp-cert-ticket-assignment-data",
    resolveRuntimeSnapshots: (input) => [input.ticketAssignmentRuntime]
  },
  {
    certificationName: "Ticket Conversation Runtime Certification",
    certificationScope: "SP-7 Support Ticket Conversation runtime is read-only on page load",
    dataCertificationKey: "sp-cert-ticket-conversation-data",
    derivedOnly: false,
    expectedSources: ["support_ticket_conversation_runtime"],
    groupKey: "tickets-runtime-certification",
    registryKeys: ["sp-ticket-conversation"],
    runtimeGuarantee: "ticket conversation is read-only on page load",
    securityCertificationKey: "sp-sec-sp-cert-ticket-conversation-data",
    resolveRuntimeSnapshots: (input) => [input.ticketConversationRuntime]
  },
  {
    certificationName: "Monitoring Events Runtime Certification",
    certificationScope: "SP-8 Support Monitoring Events runtime is read-only on page load",
    dataCertificationKey: "sp-cert-monitoring-events-data",
    derivedOnly: false,
    expectedSources: ["support_monitoring_events_runtime"],
    groupKey: "events-runtime-certification",
    registryKeys: ["sp-monitoring-events"],
    runtimeGuarantee: "monitoring events are read-only",
    securityCertificationKey: "sp-sec-sp-cert-monitoring-events-data",
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime]
  },
  {
    certificationName: "Error Events Runtime Certification",
    certificationScope: "SP-9 Support Error Events runtime is read-only on page load",
    dataCertificationKey: "sp-cert-error-events-data",
    derivedOnly: false,
    expectedSources: ["support_error_events_runtime"],
    groupKey: "events-runtime-certification",
    registryKeys: ["sp-error-events"],
    runtimeGuarantee: "error events are read-only",
    securityCertificationKey: "sp-sec-sp-cert-error-events-data",
    resolveRuntimeSnapshots: (input) => [input.errorEventsRuntime]
  },
  {
    certificationName: "Event Timeline Runtime Certification",
    certificationScope: "SP-10 Support Event Timeline runtime is read-only on page load",
    dataCertificationKey: "sp-cert-event-timeline-data",
    derivedOnly: false,
    expectedSources: ["support_event_timeline_runtime"],
    groupKey: "events-runtime-certification",
    registryKeys: ["sp-event-timeline"],
    runtimeGuarantee: "event timeline is read-only",
    securityCertificationKey: "sp-sec-sp-cert-event-timeline-data",
    resolveRuntimeSnapshots: (input) => [input.eventTimelineRuntime]
  },
  {
    certificationName: "Search Runtime Certification",
    certificationScope: "SP-11 Support Search runtime is read-only on page load",
    dataCertificationKey: "sp-cert-search-data",
    derivedOnly: true,
    expectedSources: ["support_search_runtime"],
    groupKey: "discovery-runtime-certification",
    registryKeys: ["sp-search"],
    runtimeGuarantee: "search is read-only",
    securityCertificationKey: "sp-sec-sp-cert-search-data",
    resolveRuntimeSnapshots: (input) => [input.searchRuntime]
  },
  {
    certificationName: "Filters Runtime Certification",
    certificationScope: "SP-12 Support Filters runtime is read-only on page load",
    dataCertificationKey: "sp-cert-filters-data",
    derivedOnly: true,
    expectedSources: ["support_filters_runtime"],
    groupKey: "discovery-runtime-certification",
    registryKeys: ["sp-filters"],
    runtimeGuarantee: "filters are read-only",
    securityCertificationKey: "sp-sec-sp-cert-filters-data",
    resolveRuntimeSnapshots: (input) => [input.filtersRuntime]
  },
  {
    certificationName: "Metrics Runtime Certification",
    certificationScope: "SP-13 Support Metrics runtime is derived only",
    dataCertificationKey: "sp-cert-metrics-data",
    derivedOnly: true,
    expectedSources: ["support_metrics_runtime"],
    groupKey: "discovery-runtime-certification",
    registryKeys: ["sp-metrics"],
    runtimeGuarantee: "metrics are derived only",
    securityCertificationKey: "sp-sec-sp-cert-metrics-data",
    resolveRuntimeSnapshots: (input) => [input.metricsRuntime]
  },
  {
    certificationName: "Visibility Runtime Certification",
    certificationScope: "SP-14 Support Visibility runtime is derived only",
    dataCertificationKey: "sp-cert-visibility-data",
    derivedOnly: true,
    expectedSources: ["support_visibility_runtime"],
    groupKey: "governance-runtime-certification",
    registryKeys: ["sp-visibility"],
    runtimeGuarantee: "visibility is derived only",
    securityCertificationKey: "sp-sec-sp-cert-visibility-data",
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime]
  },
  {
    certificationName: "Safe Actions Runtime Certification",
    certificationScope: "SP-15 Support Safe Actions remain explicit and Super Admin only",
    dataCertificationKey: "sp-cert-safe-actions-data",
    derivedOnly: false,
    expectedSources: ["support_safe_actions_runtime"],
    groupKey: "governance-runtime-certification",
    registryKeys: ["sp-safe-actions"],
    runtimeGuarantee: "safe actions require explicit authorization",
    securityCertificationKey: "sp-sec-sp-cert-safe-actions-data",
    resolveRuntimeSnapshots: (input) => [input.safeActionsRuntime]
  },
  {
    certificationName: "Audit Runtime Certification",
    certificationScope: "SP-16 Support Audit runtime is read-only on page load",
    dataCertificationKey: "sp-cert-audit-data",
    derivedOnly: true,
    expectedSources: ["support_audit_runtime"],
    groupKey: "governance-runtime-certification",
    registryKeys: ["sp-audit"],
    runtimeGuarantee: "audit is read-only",
    securityCertificationKey: "sp-sec-sp-cert-audit-data",
    resolveRuntimeSnapshots: (input) => [input.auditRuntime]
  },
  {
    certificationName: "Review Runtime Certification",
    certificationScope: "SP-17 Support Review runtime is derived only",
    dataCertificationKey: "sp-cert-review-data",
    derivedOnly: true,
    expectedSources: ["support_review_runtime"],
    groupKey: "governance-runtime-certification",
    registryKeys: ["sp-review"],
    runtimeGuarantee: "review is derived only",
    securityCertificationKey: "sp-sec-sp-cert-review-data",
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime]
  },
  {
    certificationName: "Notifications Runtime Certification",
    certificationScope: "SP-18 Support Notifications runtime is read-only on page load",
    dataCertificationKey: "sp-cert-notifications-data",
    derivedOnly: true,
    expectedSources: ["support_notifications_runtime"],
    groupKey: "governance-runtime-certification",
    registryKeys: ["sp-notifications"],
    runtimeGuarantee: "notifications are read-only",
    securityCertificationKey: "sp-sec-sp-cert-notifications-data",
    resolveRuntimeSnapshots: (input) => [input.notificationsRuntime]
  },
  {
    certificationName: "Analytics Runtime Certification",
    certificationScope: "SP-19 Support Analytics runtime is derived only",
    dataCertificationKey: "sp-cert-analytics-data",
    derivedOnly: true,
    expectedSources: ["support_analytics_runtime"],
    groupKey: "analytics-export-runtime-certification",
    registryKeys: ["sp-analytics"],
    runtimeGuarantee: "analytics are derived only",
    securityCertificationKey: "sp-sec-sp-cert-analytics-data",
    resolveRuntimeSnapshots: (input) => [input.analyticsRuntime]
  },
  {
    certificationName: "Export Runtime Certification",
    certificationScope: "SP-20 Support Export runtime is explicit download only",
    dataCertificationKey: "sp-cert-export-data",
    derivedOnly: false,
    expectedSources: ["support_export_runtime"],
    groupKey: "analytics-export-runtime-certification",
    registryKeys: ["sp-export"],
    runtimeGuarantee: "export is explicit download only",
    securityCertificationKey: "sp-sec-sp-cert-export-data",
    resolveRuntimeSnapshots: (input) => [input.exportRuntime]
  },
  {
    certificationName: "Status Runtime Certification",
    certificationScope: "SP-21 Support Status runtime is derived only",
    dataCertificationKey: "sp-cert-status-data",
    derivedOnly: true,
    expectedSources: ["support_status_runtime"],
    groupKey: "analytics-export-runtime-certification",
    registryKeys: ["sp-status"],
    runtimeGuarantee: "status is derived only",
    securityCertificationKey: "sp-sec-sp-cert-status-data",
    resolveRuntimeSnapshots: (input) => [input.statusRuntime]
  },
  {
    certificationName: "Data Certification Review",
    certificationScope: "SP-22 Support Data Certification runtime is read-only",
    dataCertificationKey: null,
    derivedOnly: false,
    expectedSources: ["support_data_certification_runtime"],
    groupKey: "data-certification-review",
    registryKeys: ["sp-data-certification"],
    runtimeGuarantee: "data certification is read-only",
    securityCertificationKey: "sp-sec-data-certification-security-review",
    resolveRuntimeSnapshots: (input) => [input.dataCertification]
  },
  {
    certificationName: "Security Certification Review",
    certificationScope: "SP-23 Support Security Certification runtime is read-only",
    dataCertificationKey: null,
    derivedOnly: false,
    expectedSources: ["support_security_certification_runtime"],
    groupKey: "security-certification-review",
    registryKeys: ["sp-security-certification"],
    runtimeGuarantee: "security certification is read-only",
    securityCertificationKey: null,
    resolveRuntimeSnapshots: (input) => [input.securityCertification]
  }
] as const;

function buildSafeControls() {
  return SUPPORT_RUNTIME_CERTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectRegistryCounts(input: SupportRuntimeCertificationInput, registryKeys: readonly string[]) {
  const reviewItems = input.reviewItems.filter((item) => registryKeys.includes(item.registryKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    certifiedModules: reviewItems.filter((item) => item.reviewStatus === "clear").length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function validateRuntimeShape(snapshots: SupportRuntimeCertificationRuntimeSnapshot[], expectedSources: readonly string[]) {
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

function mapBinaryStatus(passed: boolean): SupportRuntimeCertificationStatus {
  return passed ? "certified" : "review_required";
}

function mapDataSafetyStatus(item: SupportDataCertificationItem | null): SupportRuntimeCertificationStatus {
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

function mapStateSafetyStatus(item: SupportDataCertificationItem | null): SupportRuntimeCertificationStatus {
  if (!item) {
    return "review_required";
  }

  return item.stateCoverageStatus === "covered" ? "certified" : "review_required";
}

function mapSecuritySafetyStatus(item: SupportSecurityCertificationItem | null): SupportRuntimeCertificationStatus {
  if (!item) {
    return "review_required";
  }

  if (item.blockedModules > 0) {
    return "blocked";
  }

  if (item.warningModules > 0) {
    return "warning";
  }

  const certified =
    item.superAdminOnlyStatus === "certified" &&
    item.readOnlyStatus === "certified" &&
    item.mutationSafetyStatus === "certified" &&
    item.executionSafetyStatus === "certified" &&
    item.secretSafetyStatus === "certified" &&
    item.privateDataSafetyStatus === "certified" &&
    item.rlsSafetyStatus === "certified" &&
    item.visibilitySafetyStatus === "certified" &&
    item.actionSafetyStatus === "certified";

  return certified ? "certified" : "review_required";
}

function resolveRuntimeIntegrityStatus(input: {
  blockedModules: number;
  dataSafetyStatus: SupportRuntimeCertificationStatus;
  runtimeShapeValid: boolean;
  securitySafetyStatus: SupportRuntimeCertificationStatus;
  stateSafetyStatus: SupportRuntimeCertificationStatus;
  warningModules: number;
}): SupportRuntimeCertificationStatus {
  if (
    !input.runtimeShapeValid ||
    input.blockedModules > 0 ||
    input.dataSafetyStatus === "blocked" ||
    input.securitySafetyStatus === "blocked" ||
    input.stateSafetyStatus === "blocked"
  ) {
    return "blocked";
  }

  if (
    input.warningModules > 0 ||
    input.dataSafetyStatus === "warning" ||
    input.securitySafetyStatus === "warning" ||
    input.stateSafetyStatus === "warning"
  ) {
    return "warning";
  }

  if (
    input.dataSafetyStatus === "review_required" ||
    input.securitySafetyStatus === "review_required" ||
    input.stateSafetyStatus === "review_required"
  ) {
    return "review_required";
  }

  return "certified";
}

function buildRuntimeCertificationItem(
  definition: RuntimeScopeDefinition,
  input: SupportRuntimeCertificationInput
): SupportRuntimeCertificationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const dataCertificationItem = definition.dataCertificationKey
    ? input.dataCertificationItems.find((item) => item.certificationKey === definition.dataCertificationKey) ?? null
    : null;
  const securityCertificationItem = definition.securityCertificationKey
    ? input.securityCertificationItems.find(
        (item) => item.securityCertificationKey === definition.securityCertificationKey
      ) ?? null
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
        : collectRegistryCounts(input, definition.registryKeys);
  const readOnlyStatus = mapBinaryStatus(runtimeShapeValid);
  const mutationSafetyStatus = mapBinaryStatus(
    runtimeShapeValid &&
      snapshots.every((snapshot) => snapshot.readOnly === true) &&
      (dataCertificationItem?.mutationSafetyStatus === "read_only_certified" || definition.derivedOnly)
  );
  const executionSafetyStatus = mapBinaryStatus(
    securityCertificationItem?.executionSafetyStatus === "certified" || runtimeShapeValid
  );
  const dataSafetyStatus =
    definition.groupKey === "data-certification-review"
      ? mapBinaryStatus(
          input.dataCertification.readOnly === true &&
            input.dataCertification.source === "support_data_certification_runtime"
        )
      : definition.groupKey === "security-certification-review"
        ? mapBinaryStatus(
            input.securityCertification.readOnly === true &&
              input.securityCertification.source === "support_security_certification_runtime"
          )
        : mapDataSafetyStatus(dataCertificationItem);
  const securitySafetyStatus =
    definition.groupKey === "security-certification-review"
      ? mapBinaryStatus(
          input.securityCertification.readOnly === true &&
            input.securityCertification.source === "support_security_certification_runtime"
        )
      : mapSecuritySafetyStatus(securityCertificationItem);
  const stateSafetyStatus =
    definition.groupKey === "data-certification-review" || definition.groupKey === "security-certification-review"
      ? mapBinaryStatus(runtimeShapeValid)
      : mapStateSafetyStatus(dataCertificationItem);
  const runtimeIntegrityStatus = resolveRuntimeIntegrityStatus({
    blockedModules: moduleCounts.blockedModules,
    dataSafetyStatus,
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
    readOnlyStatus,
    runtimeCertificationKey: `sp-runtime-${definition.dataCertificationKey ?? definition.groupKey}`,
    runtimeIntegrityStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `guarantee ${definition.runtimeGuarantee}`,
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
    stateSafetyStatus,
    warningModules: moduleCounts.warningModules
  };
}

export function resolveSupportRuntimeCertificationAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportRuntimeCertificationAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewRuntimeCertification: true,
      reason: "Super Admin may view Support runtime certification through read-only runtime validation.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewRuntimeCertification: false,
    reason: "Support runtime certification is restricted to Super Admin in SP-24.",
    roleLabel: input.role
  };
}

export function supportRuntimeCertificationStatusLabel(status: SupportRuntimeCertificationStatus) {
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

export function supportRuntimeCertificationStatusTone(status: SupportRuntimeCertificationStatus) {
  switch (status) {
    case "certified":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function supportRuntimeCertificationRuntimeStatusBadgeTone(
  status: SupportRuntimeCertificationSummary["overallStatus"]
): "amber" | "green" {
  return status === "support_runtime_certification_ready" ? "green" : "amber";
}

export function isSupportRuntimeScopeCertified(item: SupportRuntimeCertificationItem) {
  return (
    item.runtimeIntegrityStatus === "certified" &&
    item.readOnlyStatus === "certified" &&
    item.mutationSafetyStatus === "certified" &&
    item.executionSafetyStatus === "certified" &&
    item.dataSafetyStatus === "certified" &&
    item.securitySafetyStatus === "certified" &&
    item.stateSafetyStatus === "certified"
  );
}

export function buildSupportRuntimeCertificationGroups(
  items: SupportRuntimeCertificationItem[]
): SupportRuntimeCertificationGroup[] {
  return RUNTIME_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

function getSupportRuntimeCertificationSummary(
  items: SupportRuntimeCertificationItem[],
  input: Pick<
    SupportRuntimeCertificationInput,
    "authorization" | "hiddenRecordCount" | "loadError" | "restrictedRecordCount" | "role" | "visibilityAuthorization"
  >
): SupportRuntimeCertificationSummary {
  const registryEntry = getSupportRegistryEntry("sp-runtime-certification");
  const hiddenRecordCount = input.hiddenRecordCount ?? 0;
  const restrictedRecordCount = input.restrictedRecordCount ?? 0;

  if (
    !input.authorization.canViewRuntimeCertification ||
    !input.visibilityAuthorization.canViewSupportData ||
    input.role !== "super_admin"
  ) {
    return {
      blockedScopes: 0,
      certifiedScopes: 0,
      emptyMessage: "Support runtime certification is hidden for the current account.",
      groupCount: 0,
      loadError: null,
      loadingState: "unauthorized",
      overallStatus: "needs_attention",
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: RUNTIME_SCOPE_DEFINITIONS.length,
      source: SUPPORT_RUNTIME_CERTIFICATION_SOURCE,
      summary: input.authorization.reason,
      totalCertifications: RUNTIME_SCOPE_DEFINITIONS.length,
      unauthorizedMessage:
        "Support runtime certification is Super Admin only. No runtime mutation runs during page load.",
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
      source: SUPPORT_RUNTIME_CERTIFICATION_SOURCE,
      summary: `status load_error; ${input.loadError}`,
      totalCertifications: items.length,
      unauthorizedMessage: null,
      warningScopes: 0
    };
  }

  const certifiedScopes = items.filter((item) => isSupportRuntimeScopeCertified(item)).length;
  const reviewRequiredScopes = items.filter(
    (item) => !isSupportRuntimeScopeCertified(item) && item.runtimeIntegrityStatus === "review_required"
  ).length;
  const blockedScopes = items.filter((item) => item.runtimeIntegrityStatus === "blocked").length;
  const warningScopes = items.filter((item) => item.runtimeIntegrityStatus === "warning").length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("support_runtime_certification_ready" as const);
  const loadingState: SupportRuntimeCertificationLoadingState =
    restrictedRecordCount > 0
      ? "restricted"
      : certifiedScopes === 0
        ? "empty"
        : overallStatus === "support_runtime_certification_ready"
          ? "certified"
          : "restricted";

  return {
    blockedScopes,
    certifiedScopes,
    emptyMessage:
      certifiedScopes === 0 ? "No Support runtime scopes are fully certified for the current runtime snapshot." : null,
    groupCount: buildSupportRuntimeCertificationGroups(items).length,
    loadError: null,
    loadingState,
    overallStatus,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      restrictedRecordCount > 0
        ? `${restrictedRecordCount} record(s) excluded from Support runtime certification under SP-14 visibility rules.`
        : null,
    reviewRequiredScopes,
    source: SUPPORT_RUNTIME_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} runtime scopes`,
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

export function buildSupportRuntimeCertificationReadOnlySafe(input: SupportRuntimeCertificationInput) {
  const runtimeCertificationItems = RUNTIME_SCOPE_DEFINITIONS.map((definition) =>
    buildRuntimeCertificationItem(definition, input)
  );
  const groups = buildSupportRuntimeCertificationGroups(runtimeCertificationItems);
  const runtimeCertification = getSupportRuntimeCertificationSummary(runtimeCertificationItems, input);

  return {
    runtimeCertification,
    runtimeCertificationGroups: groups,
    runtimeCertificationItems,
    runtimeCertificationSafeControls: buildSafeControls()
  };
}

export function mapSupportRuntimeCertificationToAdminFields(
  input: ReturnType<typeof buildSupportRuntimeCertificationReadOnlySafe>
) {
  return input;
}

export function toSupportRuntimeCertificationSnapshot(input: {
  readOnly?: boolean;
  source?: string;
  summary?: string;
}): SupportRuntimeCertificationRuntimeSnapshot {
  return {
    readOnly: input.readOnly ?? true,
    source: input.source,
    summary: input.summary
  };
}
