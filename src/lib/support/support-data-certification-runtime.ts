import "server-only";

import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { SupportAuditRuntimeItem } from "@/src/lib/support/support-audit-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportReviewRuntimeItem } from "@/src/lib/support/support-review-runtime";
import type { SupportStatusRuntimeItem } from "@/src/lib/support/support-status-runtime";
import type { SupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";
import type { SupportVisibilityRuntimeItem } from "@/src/lib/support/support-visibility-runtime";

export type SupportDataCertificationSource = "support_data_certification_runtime";

export type SupportDataCertificationGroupKey =
  | "analytics-export-data-certification"
  | "discovery-data-certification"
  | "events-data-certification"
  | "governance-data-certification"
  | "platform-data-certification"
  | "tickets-data-certification";

export type SupportDataCertificationIntegrityStatus = "blocked" | "certified" | "review_required" | "warning";

export type SupportDataCertificationPlaceholderStatus = "certified" | "labeled_placeholders" | "review_required";

export type SupportDataCertificationSafetyStatus = "read_only_certified" | "review_required";

export type SupportDataCertificationSecretStatus = "review_required" | "safe";

export type SupportDataCertificationExecutionStatus = "no_execution_certified" | "review_required";

export type SupportDataCertificationStateCoverageStatus = "covered" | "review_required";

export type SupportDataCertificationLoadingState =
  | "certified"
  | "empty"
  | "error"
  | "restricted"
  | "unauthorized";

export type SupportDataCertificationSafeControlKey =
  | "approve_certification"
  | "export_certification"
  | "mark_certified"
  | "recheck_data"
  | "resolve_blocker";

export type SupportDataCertificationSafeControl = {
  enabled: false;
  key: SupportDataCertificationSafeControlKey;
  label: string;
  note: string;
};

export type SupportDataCertificationItem = {
  blockedModules: number;
  certificationKey: string;
  certificationName: string;
  certificationScope: string;
  certifiedModules: number;
  dataIntegrityStatus: SupportDataCertificationIntegrityStatus;
  executionSafetyStatus: SupportDataCertificationExecutionStatus;
  groupKey: SupportDataCertificationGroupKey;
  mutationSafetyStatus: SupportDataCertificationSafetyStatus;
  placeholderStatus: SupportDataCertificationPlaceholderStatus;
  registryKey: string;
  reviewRequiredModules: number;
  safeControls: SupportDataCertificationSafeControl[];
  safeSummary: string;
  secretSafetyStatus: SupportDataCertificationSecretStatus;
  stateCoverageStatus: SupportDataCertificationStateCoverageStatus;
  warningModules: number;
};

export type SupportDataCertificationGroup = {
  groupKey: SupportDataCertificationGroupKey;
  itemCount: number;
  items: SupportDataCertificationItem[];
  title: string;
};

export type SupportDataCertificationSummary = {
  blockedScopes: number;
  certifiedScopes: number;
  emptyMessage: string | null;
  groupCount: number;
  loadError: string | null;
  loadingState: SupportDataCertificationLoadingState;
  overallStatus: "needs_attention" | "support_data_certification_ready";
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  reviewRequiredScopes: number;
  source: SupportDataCertificationSource;
  summary: string;
  totalCertifications: number;
  unauthorizedMessage: string | null;
  warningScopes: number;
};

export type SupportDataCertificationRuntimeSnapshot = {
  loadError?: string | null;
  loadingState?: string | null;
  readOnly?: boolean;
  source?: string;
  status?: string;
  summary?: string;
};

export type SupportDataCertificationAuthorization = {
  canViewDataCertification: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportDataCertificationInput = {
  analyticsRuntime: SupportDataCertificationRuntimeSnapshot;
  auditRuntime: SupportDataCertificationRuntimeSnapshot;
  authorization: SupportDataCertificationAuthorization;
  dashboardRuntime: SupportDataCertificationRuntimeSnapshot;
  errorEventsRuntime: SupportDataCertificationRuntimeSnapshot;
  eventTimelineRuntime: SupportDataCertificationRuntimeSnapshot;
  exportRuntime: SupportDataCertificationRuntimeSnapshot;
  filtersRuntime: SupportDataCertificationRuntimeSnapshot;
  hiddenRecordCount?: number;
  loadError?: string | null;
  metricsRuntime: SupportDataCertificationRuntimeSnapshot;
  monitoringEventsRuntime: SupportDataCertificationRuntimeSnapshot;
  notificationsRuntime: SupportDataCertificationRuntimeSnapshot;
  registryProductionReadyCount: number;
  registryRuntime: SupportDataCertificationRuntimeSnapshot;
  registryTotalModuleCount: number;
  restrictedRecordCount?: number;
  reviewItems: Array<Pick<SupportReviewRuntimeItem, "registryKey" | "reviewStatus" | "safeSummary">>;
  reviewRuntime: SupportDataCertificationRuntimeSnapshot;
  safeActionsRuntime: SupportDataCertificationRuntimeSnapshot;
  searchRuntime: SupportDataCertificationRuntimeSnapshot;
  statusItems: Array<
    Pick<SupportStatusRuntimeItem, "moduleKey" | "operationalStatus" | "providerStatus" | "registryKey" | "safeSummary">
  >;
  statusRuntime: SupportDataCertificationRuntimeSnapshot;
  ticketAssignmentRuntime: SupportDataCertificationRuntimeSnapshot;
  ticketConversationRuntime: SupportDataCertificationRuntimeSnapshot;
  ticketDetailsRuntime: SupportDataCertificationRuntimeSnapshot;
  ticketStatusRuntime: SupportDataCertificationRuntimeSnapshot;
  ticketsRuntime: SupportDataCertificationRuntimeSnapshot;
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibilityItems: Array<Pick<SupportVisibilityRuntimeItem, "registryKey" | "safeSummary" | "visibility">>;
  visibilityRuntime: SupportDataCertificationRuntimeSnapshot;
  auditItems: Array<Pick<SupportAuditRuntimeItem, "registryKey" | "resultStatus" | "safeSummary">>;
};

export const SUPPORT_DATA_CERTIFICATION_SOURCE = "support_data_certification_runtime" as const;

export const SUPPORT_DATA_CERTIFICATION_SAFE_CONTROLS: readonly SupportDataCertificationSafeControl[] = [
  {
    enabled: false,
    key: "approve_certification",
    label: "Approve Certification",
    note: "Read-only placeholder. No certification approval or mutation runs during SP-22 page load."
  },
  {
    enabled: false,
    key: "recheck_data",
    label: "Recheck Data",
    note: "Read-only placeholder. No recheck execution, provider call, or data mutation runs during SP-22 page load."
  },
  {
    enabled: false,
    key: "export_certification",
    label: "Export Certification",
    note: "Read-only placeholder. No certification export runs during SP-22 page load."
  },
  {
    enabled: false,
    key: "resolve_blocker",
    label: "Resolve Blocker",
    note: "Read-only placeholder. No blocker resolve action runs during SP-22 page load."
  },
  {
    enabled: false,
    key: "mark_certified",
    label: "Mark Certified",
    note: "Read-only placeholder. No certification record write or registry mutation runs during SP-22 page load."
  }
] as const;

const CERTIFICATION_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportDataCertificationGroupKey;
  title: string;
}> = [
  { groupKey: "platform-data-certification", title: "Platform Data Certification" },
  { groupKey: "tickets-data-certification", title: "Tickets Data Certification" },
  { groupKey: "events-data-certification", title: "Events Data Certification" },
  { groupKey: "discovery-data-certification", title: "Discovery Data Certification" },
  { groupKey: "governance-data-certification", title: "Governance Data Certification" },
  { groupKey: "analytics-export-data-certification", title: "Analytics & Export Data Certification" }
];

type CertificationScopeDefinition = {
  certificationKey: string;
  certificationName: string;
  certificationScope: string;
  expectedSources: readonly string[];
  groupKey: SupportDataCertificationGroupKey;
  registryKey: string;
  resolveRuntimeSnapshots: (input: SupportDataCertificationInput) => SupportDataCertificationRuntimeSnapshot[];
};

const CERTIFICATION_SCOPE_DEFINITIONS: readonly CertificationScopeDefinition[] = [
  {
    certificationKey: "sp-cert-registry-data",
    certificationName: "Support Registry Data Certification",
    certificationScope: "SP-1 Support Registry read-only runtime metadata",
    expectedSources: [SUPPORT_REGISTRY_SOURCE],
    groupKey: "platform-data-certification",
    registryKey: "sp-registry",
    resolveRuntimeSnapshots: (input) => [input.registryRuntime]
  },
  {
    certificationKey: "sp-cert-dashboard-data",
    certificationName: "Support Dashboard Data Certification",
    certificationScope: "SP-2 Support Dashboard read-only runtime metadata",
    expectedSources: ["support_dashboard_runtime"],
    groupKey: "platform-data-certification",
    registryKey: "sp-dashboard",
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime]
  },
  {
    certificationKey: "sp-cert-tickets-data",
    certificationName: "Tickets Data Certification",
    certificationScope: "SP-3 Support Tickets read-only runtime metadata",
    expectedSources: ["support_tickets_runtime"],
    groupKey: "tickets-data-certification",
    registryKey: "sp-tickets",
    resolveRuntimeSnapshots: (input) => [input.ticketsRuntime]
  },
  {
    certificationKey: "sp-cert-ticket-details-data",
    certificationName: "Ticket Details Data Certification",
    certificationScope: "SP-4 Support Ticket Details read-only runtime metadata",
    expectedSources: ["support_ticket_details_runtime"],
    groupKey: "tickets-data-certification",
    registryKey: "sp-ticket-details",
    resolveRuntimeSnapshots: (input) => [input.ticketDetailsRuntime]
  },
  {
    certificationKey: "sp-cert-ticket-status-data",
    certificationName: "Ticket Status Data Certification",
    certificationScope: "SP-5 Support Ticket Status read-only runtime metadata",
    expectedSources: ["support_ticket_status_runtime"],
    groupKey: "tickets-data-certification",
    registryKey: "sp-ticket-status",
    resolveRuntimeSnapshots: (input) => [input.ticketStatusRuntime]
  },
  {
    certificationKey: "sp-cert-ticket-assignment-data",
    certificationName: "Ticket Assignment Data Certification",
    certificationScope: "SP-6 Support Ticket Assignment read-only runtime metadata",
    expectedSources: ["support_ticket_assignment_runtime"],
    groupKey: "tickets-data-certification",
    registryKey: "sp-ticket-assignment",
    resolveRuntimeSnapshots: (input) => [input.ticketAssignmentRuntime]
  },
  {
    certificationKey: "sp-cert-ticket-conversation-data",
    certificationName: "Ticket Conversation Data Certification",
    certificationScope: "SP-7 Support Ticket Conversation read-only runtime metadata",
    expectedSources: ["support_ticket_conversation_runtime"],
    groupKey: "tickets-data-certification",
    registryKey: "sp-ticket-conversation",
    resolveRuntimeSnapshots: (input) => [input.ticketConversationRuntime]
  },
  {
    certificationKey: "sp-cert-monitoring-events-data",
    certificationName: "Monitoring Events Data Certification",
    certificationScope: "SP-8 Support Monitoring Events read-only runtime metadata",
    expectedSources: ["support_monitoring_events_runtime"],
    groupKey: "events-data-certification",
    registryKey: "sp-monitoring-events",
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime]
  },
  {
    certificationKey: "sp-cert-error-events-data",
    certificationName: "Error Events Data Certification",
    certificationScope: "SP-9 Support Error Events read-only runtime metadata",
    expectedSources: ["support_error_events_runtime"],
    groupKey: "events-data-certification",
    registryKey: "sp-error-events",
    resolveRuntimeSnapshots: (input) => [input.errorEventsRuntime]
  },
  {
    certificationKey: "sp-cert-event-timeline-data",
    certificationName: "Event Timeline Data Certification",
    certificationScope: "SP-10 Support Event Timeline read-only runtime metadata",
    expectedSources: ["support_event_timeline_runtime"],
    groupKey: "events-data-certification",
    registryKey: "sp-event-timeline",
    resolveRuntimeSnapshots: (input) => [input.eventTimelineRuntime]
  },
  {
    certificationKey: "sp-cert-search-data",
    certificationName: "Search Data Certification",
    certificationScope: "SP-11 Support Search read-only runtime metadata",
    expectedSources: ["support_search_runtime"],
    groupKey: "discovery-data-certification",
    registryKey: "sp-search",
    resolveRuntimeSnapshots: (input) => [input.searchRuntime]
  },
  {
    certificationKey: "sp-cert-filters-data",
    certificationName: "Filters Data Certification",
    certificationScope: "SP-12 Support Filters read-only runtime metadata",
    expectedSources: ["support_filters_runtime"],
    groupKey: "discovery-data-certification",
    registryKey: "sp-filters",
    resolveRuntimeSnapshots: (input) => [input.filtersRuntime]
  },
  {
    certificationKey: "sp-cert-metrics-data",
    certificationName: "Metrics Data Certification",
    certificationScope: "SP-13 Support Metrics read-only runtime metadata",
    expectedSources: ["support_metrics_runtime"],
    groupKey: "discovery-data-certification",
    registryKey: "sp-metrics",
    resolveRuntimeSnapshots: (input) => [input.metricsRuntime]
  },
  {
    certificationKey: "sp-cert-visibility-data",
    certificationName: "Visibility Data Certification",
    certificationScope: "SP-14 Support Visibility read-only runtime metadata",
    expectedSources: ["support_visibility_runtime"],
    groupKey: "governance-data-certification",
    registryKey: "sp-visibility",
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime]
  },
  {
    certificationKey: "sp-cert-safe-actions-data",
    certificationName: "Safe Actions Data Certification",
    certificationScope: "SP-15 Support Safe Actions read-only runtime metadata",
    expectedSources: ["support_safe_actions_runtime"],
    groupKey: "governance-data-certification",
    registryKey: "sp-safe-actions",
    resolveRuntimeSnapshots: (input) => [input.safeActionsRuntime]
  },
  {
    certificationKey: "sp-cert-audit-data",
    certificationName: "Audit Data Certification",
    certificationScope: "SP-16 Support Audit read-only runtime metadata",
    expectedSources: ["support_audit_runtime"],
    groupKey: "governance-data-certification",
    registryKey: "sp-audit",
    resolveRuntimeSnapshots: (input) => [input.auditRuntime]
  },
  {
    certificationKey: "sp-cert-review-data",
    certificationName: "Review Data Certification",
    certificationScope: "SP-17 Support Review read-only runtime metadata",
    expectedSources: ["support_review_runtime"],
    groupKey: "governance-data-certification",
    registryKey: "sp-review",
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime]
  },
  {
    certificationKey: "sp-cert-notifications-data",
    certificationName: "Notifications Data Certification",
    certificationScope: "SP-18 Support Notifications read-only runtime metadata",
    expectedSources: ["support_notifications_runtime"],
    groupKey: "governance-data-certification",
    registryKey: "sp-notifications",
    resolveRuntimeSnapshots: (input) => [input.notificationsRuntime]
  },
  {
    certificationKey: "sp-cert-analytics-data",
    certificationName: "Analytics Data Certification",
    certificationScope: "SP-19 Support Analytics read-only runtime metadata",
    expectedSources: ["support_analytics_runtime"],
    groupKey: "analytics-export-data-certification",
    registryKey: "sp-analytics",
    resolveRuntimeSnapshots: (input) => [input.analyticsRuntime]
  },
  {
    certificationKey: "sp-cert-export-data",
    certificationName: "Export Data Certification",
    certificationScope: "SP-20 Support Export read-only runtime metadata on page load",
    expectedSources: ["support_export_runtime"],
    groupKey: "analytics-export-data-certification",
    registryKey: "sp-export",
    resolveRuntimeSnapshots: (input) => [input.exportRuntime]
  },
  {
    certificationKey: "sp-cert-status-data",
    certificationName: "Status Data Certification",
    certificationScope: "SP-21 Support Status read-only runtime metadata",
    expectedSources: ["support_status_runtime"],
    groupKey: "analytics-export-data-certification",
    registryKey: "sp-status",
    resolveRuntimeSnapshots: (input) => [input.statusRuntime]
  }
] as const;

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|authorization|bearer|sb_secret|smtp|webhook|stack trace|provider payload|payment data)/i;

const EXPECTED_PRODUCTION_READY_MODULES = 20;

function buildSafeControls() {
  return SUPPORT_DATA_CERTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function sanitizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return maskSensitiveText(value).slice(0, maxLength);
}

function collectReviewCounts(input: SupportDataCertificationInput, registryKey: string) {
  const reviewItems = input.reviewItems.filter((item) => item.registryKey === registryKey);

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    certifiedModules: reviewItems.filter((item) => item.reviewStatus === "clear").length,
    reviewRequiredModules: reviewItems.filter((item) => item.reviewStatus === "review_required").length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function validateRuntimeShape(snapshot: SupportDataCertificationRuntimeSnapshot, expectedSources: readonly string[]) {
  const issues: string[] = [];

  if (snapshot.readOnly !== true) {
    issues.push("readOnly flag missing or false");
  }

  if (!snapshot.source || !expectedSources.includes(snapshot.source)) {
    issues.push("unexpected or missing runtime source");
  }

  if (typeof snapshot.summary !== "string" || !snapshot.summary.trim()) {
    issues.push("summary metadata missing");
  }

  if (snapshot.status?.includes("load_error") || snapshot.loadError) {
    issues.push("runtime load error detected");
  }

  return issues;
}

function validateRegistryProductionReady(registryKey: string, input: SupportDataCertificationInput) {
  if (registryKey === "sp-registry") {
    return input.registryProductionReadyCount >= EXPECTED_PRODUCTION_READY_MODULES
      ? []
      : ["registry production readiness incomplete"];
  }

  const entry = getSupportRegistryEntry(registryKey);

  if (!entry) {
    return ["registry entry missing"];
  }

  if (!entry.productionReady || entry.implementationStatus !== "production_ready") {
    return ["registry entry not production_ready"];
  }

  return [];
}

function validateStateCoverage(snapshot: SupportDataCertificationRuntimeSnapshot) {
  const status = sanitizeText(snapshot.status, 80).toLowerCase();
  const loadingState = sanitizeText(snapshot.loadingState, 40).toLowerCase();

  if (!status) {
    return ["runtime status missing"];
  }

  const hasKnownStatus =
    status.includes("_ready") ||
    status.includes("_empty") ||
    status.includes("load_error") ||
    status.includes("needs_attention") ||
    status.includes("unauthorized") ||
    status.includes("unselected") ||
    status.includes("inactive") ||
    status === "ready" ||
    status === "registry_ready";

  if (!hasKnownStatus) {
    return ["unknown runtime status"];
  }

  if (
    loadingState &&
    !["computed", "empty", "error", "export_ready", "loaded", "restricted", "success", "unauthorized", "applied", "inactive"].includes(
      loadingState
    )
  ) {
    return ["unknown loading state"];
  }

  return [];
}

function validateSecretSafety(values: string[]) {
  return values.every((value) => !secretPattern.test(value));
}

function validatePlaceholderSafety(values: string[]) {
  const combined = values.join(" ").toLowerCase();

  if (!combined.includes("placeholder")) {
    return "certified" as const;
  }

  if (
    combined.includes("read-only placeholder") ||
    combined.includes("labeled placeholder") ||
    combined.includes("placeholder derived") ||
    combined.includes("disabled placeholder")
  ) {
    return "labeled_placeholders" as const;
  }

  return "review_required" as const;
}

function resolveIntegrityStatus(input: {
  blockedModules: number;
  registryIssues: string[];
  reviewRequiredModules: number;
  runtimeIssues: string[];
  stateIssues: string[];
  warningModules: number;
}): SupportDataCertificationIntegrityStatus {
  if (input.runtimeIssues.length > 0 || input.registryIssues.length > 0 || input.stateIssues.length > 0) {
    return input.blockedModules > 0 ? "blocked" : "review_required";
  }

  if (input.reviewRequiredModules > 0) {
    return "review_required";
  }

  if (input.warningModules > 0) {
    return "warning";
  }

  return "certified";
}

function buildCertificationItem(
  definition: CertificationScopeDefinition,
  input: SupportDataCertificationInput
): SupportDataCertificationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeIssues = snapshots.flatMap((snapshot) => validateRuntimeShape(snapshot, definition.expectedSources));
  const registryIssues = validateRegistryProductionReady(definition.registryKey, input);
  const stateIssues = snapshots.flatMap((snapshot) => validateStateCoverage(snapshot));
  const reviewCounts = collectReviewCounts(input, definition.registryKey);
  const textValues = [
    ...snapshots.map((snapshot) => sanitizeText(snapshot.summary)),
    ...input.statusItems
      .filter((item) => item.registryKey === definition.registryKey)
      .map((item) => sanitizeText(item.safeSummary)),
    ...input.visibilityItems
      .filter((item) => item.registryKey === definition.registryKey)
      .map((item) => sanitizeText(item.safeSummary)),
    ...input.reviewItems
      .filter((item) => item.registryKey === definition.registryKey)
      .map((item) => sanitizeText(item.safeSummary))
  ];
  const secretSafetyStatus: SupportDataCertificationSecretStatus = validateSecretSafety(textValues)
    ? "safe"
    : "review_required";
  const placeholderStatus = validatePlaceholderSafety(textValues);
  const mutationSafetyStatus: SupportDataCertificationSafetyStatus =
    snapshots.every((snapshot) => snapshot.readOnly === true) &&
    runtimeIssues.length === 0 &&
    registryIssues.length === 0
      ? "read_only_certified"
      : "review_required";
  const executionSafetyStatus: SupportDataCertificationExecutionStatus =
    definition.registryKey === "sp-export"
      ? mutationSafetyStatus === "read_only_certified"
        ? "no_execution_certified"
        : "review_required"
      : mutationSafetyStatus === "read_only_certified"
        ? "no_execution_certified"
        : "review_required";
  const stateCoverageStatus: SupportDataCertificationStateCoverageStatus =
    stateIssues.length === 0 ? "covered" : "review_required";
  const dataIntegrityStatus = resolveIntegrityStatus({
    blockedModules: reviewCounts.blockedModules,
    registryIssues,
    reviewRequiredModules: reviewCounts.reviewRequiredModules,
    runtimeIssues,
    stateIssues,
    warningModules: reviewCounts.warningModules
  });

  return {
    blockedModules: reviewCounts.blockedModules,
    certificationKey: definition.certificationKey,
    certificationName: definition.certificationName,
    certificationScope: definition.certificationScope,
    certifiedModules: reviewCounts.certifiedModules,
    dataIntegrityStatus,
    executionSafetyStatus,
    groupKey: definition.groupKey,
    mutationSafetyStatus,
    placeholderStatus,
    registryKey: definition.registryKey,
    reviewRequiredModules: reviewCounts.reviewRequiredModules,
    safeControls: buildSafeControls(),
    safeSummary: [
      `scope ${definition.certificationScope}`,
      `${reviewCounts.certifiedModules} clear review records`,
      `${reviewCounts.reviewRequiredModules} review required`,
      `${runtimeIssues.length} runtime issue${runtimeIssues.length === 1 ? "" : "s"}`,
      `${registryIssues.length} registry issue${registryIssues.length === 1 ? "" : "s"}`,
      `mutation ${mutationSafetyStatus}`,
      `secrets ${secretSafetyStatus}`,
      `states ${stateCoverageStatus}`,
      `execution ${executionSafetyStatus}`
    ].join("; "),
    secretSafetyStatus,
    stateCoverageStatus,
    warningModules: reviewCounts.warningModules
  };
}

export function supportDataCertificationIntegrityLabel(status: SupportDataCertificationIntegrityStatus) {
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

export function supportDataCertificationIntegrityTone(status: SupportDataCertificationIntegrityStatus) {
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

export function supportDataCertificationSafetyLabel(
  status:
    | SupportDataCertificationExecutionStatus
    | SupportDataCertificationPlaceholderStatus
    | SupportDataCertificationSafetyStatus
    | SupportDataCertificationSecretStatus
    | SupportDataCertificationStateCoverageStatus
) {
  return status.replace(/_/g, " ");
}

export function supportDataCertificationRuntimeStatusBadgeTone(
  status: SupportDataCertificationSummary["overallStatus"]
): "amber" | "green" {
  return status === "support_data_certification_ready" ? "green" : "amber";
}

export function resolveSupportDataCertificationAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportDataCertificationAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewDataCertification: true,
      reason: "Super Admin may view Support data certification through read-only runtime validation.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewDataCertification: false,
    reason: "Support data certification is restricted to Super Admin in SP-22.",
    roleLabel: input.role
  };
}

export function buildSupportDataCertificationGroups(items: SupportDataCertificationItem[]): SupportDataCertificationGroup[] {
  return CERTIFICATION_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

function getSupportDataCertificationSummary(
  items: SupportDataCertificationItem[],
  input: Pick<
    SupportDataCertificationInput,
    "authorization" | "hiddenRecordCount" | "loadError" | "restrictedRecordCount" | "visibilityAuthorization"
  >
): SupportDataCertificationSummary {
  const registryEntry = getSupportRegistryEntry("sp-data-certification");
  const restrictedRecordCount = input.restrictedRecordCount ?? 0;
  const hiddenRecordCount = input.hiddenRecordCount ?? 0;

  if (!input.authorization.canViewDataCertification || !input.visibilityAuthorization.canViewSupportData) {
    return {
      blockedScopes: 0,
      certifiedScopes: 0,
      emptyMessage: "Support data certification is hidden for the current account.",
      groupCount: 0,
      loadError: null,
      loadingState: "unauthorized",
      overallStatus: "needs_attention",
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      reviewRequiredScopes: 0,
      source: SUPPORT_DATA_CERTIFICATION_SOURCE,
      summary: input.authorization.reason,
      totalCertifications: CERTIFICATION_SCOPE_DEFINITIONS.length,
      unauthorizedMessage: "Support data certification is Super Admin only. No certification mutation runs during page load.",
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
      source: SUPPORT_DATA_CERTIFICATION_SOURCE,
      summary: `status load_error; ${input.loadError}`,
      totalCertifications: items.length,
      unauthorizedMessage: null,
      warningScopes: 0
    };
  }

  const certifiedScopes = items.filter((item) => item.dataIntegrityStatus === "certified").length;
  const reviewRequiredScopes = items.filter((item) => item.dataIntegrityStatus === "review_required").length;
  const blockedScopes = items.filter((item) => item.dataIntegrityStatus === "blocked").length;
  const warningScopes = items.filter((item) => item.dataIntegrityStatus === "warning").length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("support_data_certification_ready" as const);
  const loadingState: SupportDataCertificationLoadingState =
    restrictedRecordCount > 0
      ? "restricted"
      : certifiedScopes === 0
        ? "empty"
        : overallStatus === "support_data_certification_ready"
          ? "certified"
          : "restricted";

  return {
    blockedScopes,
    certifiedScopes,
    emptyMessage:
      certifiedScopes === 0 ? "No Support data scopes are fully certified for the current runtime snapshot." : null,
    groupCount: buildSupportDataCertificationGroups(items).length,
    loadError: null,
    loadingState,
    overallStatus,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      restrictedRecordCount > 0
        ? `${restrictedRecordCount} record(s) excluded from Support data certification under SP-14 visibility rules.`
        : null,
    reviewRequiredScopes,
    source: SUPPORT_DATA_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} certification scopes`,
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

export function buildSupportDataCertificationReadOnlySafe(input: SupportDataCertificationInput) {
  const certificationItems = CERTIFICATION_SCOPE_DEFINITIONS.map((definition) =>
    buildCertificationItem(definition, input)
  );
  const groups = buildSupportDataCertificationGroups(certificationItems);
  const dataCertification = getSupportDataCertificationSummary(certificationItems, input);

  return {
    dataCertification,
    dataCertificationGroups: groups,
    dataCertificationItems: certificationItems,
    dataCertificationSafeControls: buildSafeControls()
  };
}

export function mapSupportDataCertificationToAdminFields(
  input: ReturnType<typeof buildSupportDataCertificationReadOnlySafe>
) {
  return input;
}

export function toSupportDataCertificationSnapshot(input: {
  loadError?: string | null;
  loadingState?: string | null;
  readOnly?: boolean;
  source?: string;
  status?: string;
  summary?: string;
}): SupportDataCertificationRuntimeSnapshot {
  return {
    loadError: input.loadError ?? null,
    loadingState: input.loadingState ?? null,
    readOnly: input.readOnly ?? true,
    source: input.source,
    status: input.status,
    summary: input.summary
  };
}
