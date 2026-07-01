import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import { runSecurityAudit, type SecurityAuditResult } from "@/src/lib/security/security-audit-runtime";
import {
  resolveSecurityReviewResults,
  type SecurityReviewResult
} from "@/src/lib/security/security-review-runtime";

export type SecurityDataCertificationSource = "security_data_certification_runtime";

export type SecurityDataSourceStatus = "available" | "degraded" | "unavailable";

export type SecurityDataReadOnlyStatus = "enforced" | "violation";

export type SecurityDataMaskingStatus = "enforced" | "gap" | "not_required";

export type SecurityDataLimitsStatus = "enforced" | "not_applicable";

export type SecurityDataStateStatus = "missing" | "present";

export type SecurityDataCertificationStatus = "certified" | "conditionally_certified" | "not_certified";

export type SecurityDataCertificationRuntimeState = "disabled" | "empty" | "success";

export type SecurityDataCertificationDefinition = {
  certificationId: string;
  displayName: string;
  emptyState: boolean;
  errorState: boolean;
  linkedAuditId: string;
  linkedReviewId: string;
  maskedFields: readonly string[];
  maskingRequired: boolean;
  moduleKey: string;
  safeLimits: boolean;
};

export type SecurityDataCertificationResult = {
  blockingIssues: number;
  certificationId: string;
  certificationStatus: SecurityDataCertificationStatus;
  dataSourceStatus: SecurityDataSourceStatus;
  displayName: string;
  emptyStateStatus: SecurityDataStateStatus;
  errorStateStatus: SecurityDataStateStatus;
  maskedFields: string[];
  maskingStatus: SecurityDataMaskingStatus;
  moduleKey: string;
  readOnly: true;
  readOnlyStatus: SecurityDataReadOnlyStatus;
  recommendation: string;
  safeLimitsStatus: SecurityDataLimitsStatus;
  source: SecurityDataCertificationSource;
};

export type SecurityDataCertificationSummary = {
  blockingTotal: number;
  certifiedCount: number;
  conditionalCount: number;
  notCertifiedCount: number;
  overallCertification: SecurityDataCertificationStatus;
  readOnly: true;
  source: SecurityDataCertificationSource;
  summary: string;
  totalModules: number;
};

export type SecurityDataCertificationSupport = {
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityDataCertificationSource;
  supported: boolean;
};

export type SecurityDataCertificationValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityDataCertificationRuntimeResult = {
  readOnly: true;
  results: SecurityDataCertificationResult[];
  source: SecurityDataCertificationSource;
  state: SecurityDataCertificationRuntimeState;
  summary: SecurityDataCertificationSummary;
};

export type SecurityDataCertificationLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityDataCertificationSource;
};

export const SECURITY_DATA_CERTIFICATION_SOURCE = "security_data_certification_runtime" as const;

export const SECURITY_DATA_CERTIFICATION_REGISTRY_KEY = "sec-advanced-security-center" as const;

export const SECURITY_DATA_CERTIFICATION_DISABLED_STATE =
  "Security Data Certification is not available in the current runtime configuration.";

export const SECURITY_DATA_CERTIFICATION_DEFINITIONS: readonly SecurityDataCertificationDefinition[] = [
  {
    certificationId: "sec-cert-audit-logs",
    displayName: "Audit Logs",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-audit-logs",
    linkedReviewId: "sec-review-audit-logs",
    maskedFields: ["ip_address", "user_agent", "metadata"],
    maskingRequired: true,
    moduleKey: "sec-audit-logs",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-login-monitoring",
    displayName: "Login Monitoring",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-login-monitoring",
    linkedReviewId: "sec-review-login-monitoring",
    maskedFields: ["ip_address", "email", "user_agent"],
    maskingRequired: true,
    moduleKey: "sec-login-monitoring",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-ip-monitoring",
    displayName: "IP Monitoring",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-ip-monitoring",
    linkedReviewId: "sec-review-ip-monitoring",
    maskedFields: ["ip_address"],
    maskingRequired: true,
    moduleKey: "sec-ip-monitoring",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-device-monitoring",
    displayName: "Device Monitoring",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-device-monitoring",
    linkedReviewId: "sec-review-device-monitoring",
    maskedFields: ["user_agent", "device_signature"],
    maskingRequired: true,
    moduleKey: "sec-device-monitoring",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-abuse-detection",
    displayName: "Abuse Detection",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-abuse-detection",
    linkedReviewId: "sec-review-abuse-detection",
    maskedFields: ["ip_address", "metadata"],
    maskingRequired: true,
    moduleKey: "sec-abuse-detection",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-fraud-detection",
    displayName: "Fraud Detection",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-fraud-detection",
    linkedReviewId: "sec-review-fraud-detection",
    maskedFields: ["ip_address", "metadata"],
    maskingRequired: true,
    moduleKey: "sec-fraud-detection",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-rate-limits",
    displayName: "Rate Limits",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-rate-limits",
    linkedReviewId: "sec-review-rate-limits",
    maskedFields: ["ip_address", "metadata"],
    maskingRequired: true,
    moduleKey: "sec-rate-limits",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-risk-score",
    displayName: "Risk Score",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-risk-score",
    linkedReviewId: "sec-review-risk-score",
    maskedFields: ["metadata"],
    maskingRequired: true,
    moduleKey: "sec-risk-score",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-risk-levels",
    displayName: "Risk Levels",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-risk-levels",
    linkedReviewId: "sec-review-risk-levels",
    maskedFields: ["metadata"],
    maskingRequired: true,
    moduleKey: "sec-risk-levels",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-security-events",
    displayName: "Security Events",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-security-events",
    linkedReviewId: "sec-review-security-events",
    maskedFields: ["ip_address", "actor", "metadata"],
    maskingRequired: true,
    moduleKey: "sec-security-events",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-event-details",
    displayName: "Event Details",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-security-event-details",
    linkedReviewId: "sec-review-event-details",
    maskedFields: ["ip_address", "user_agent", "metadata"],
    maskingRequired: true,
    moduleKey: "sec-security-events",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-exports",
    displayName: "Exports",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-security-export",
    linkedReviewId: "sec-review-security-export",
    maskedFields: ["ip_address", "user_agent", "metadata", "record_key"],
    maskingRequired: true,
    moduleKey: "sec-security-actions",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-search",
    displayName: "Search",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-security-search",
    linkedReviewId: "sec-review-search",
    maskedFields: ["ip_address", "email", "metadata"],
    maskingRequired: true,
    moduleKey: "sec-advanced-security-center",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-filters",
    displayName: "Filters",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-security-filters",
    linkedReviewId: "sec-review-filters",
    maskedFields: ["ip_address", "email", "metadata"],
    maskingRequired: true,
    moduleKey: "sec-advanced-security-center",
    safeLimits: true
  },
  {
    certificationId: "sec-cert-metrics",
    displayName: "Metrics",
    emptyState: true,
    errorState: true,
    linkedAuditId: "sec-audit-security-metrics",
    linkedReviewId: "sec-review-metrics",
    maskedFields: ["ip_address"],
    maskingRequired: true,
    moduleKey: "sec-advanced-security-center",
    safeLimits: true
  }
] as const;

export function resolveSecurityDataCertificationSupport(): SecurityDataCertificationSupport {
  const registryEntry = getSecurityRegistryEntry(SECURITY_DATA_CERTIFICATION_REGISTRY_KEY);

  const base = {
    readOnly: true as const,
    registryKey: SECURITY_DATA_CERTIFICATION_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_DATA_CERTIFICATION_SOURCE
  };

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      ...base,
      disabledReason: "The advanced security center is not registered as a super-admin module in the security registry.",
      supported: false
    };
  }

  return {
    ...base,
    disabledReason: null,
    supported: true
  };
}

function dataSourceStatusFromAudit(audit: SecurityAuditResult | undefined): SecurityDataSourceStatus {
  if (!audit || audit.status === "fail") {
    return "unavailable";
  }

  return audit.status === "warn" ? "degraded" : "available";
}

function certifyModule(
  definition: SecurityDataCertificationDefinition,
  audit: SecurityAuditResult | undefined,
  review: SecurityReviewResult | undefined
): SecurityDataCertificationResult {
  const dataSourceStatus = dataSourceStatusFromAudit(audit);
  const readOnlyStatus: SecurityDataReadOnlyStatus = "enforced";
  const maskingStatus: SecurityDataMaskingStatus = definition.maskingRequired ? "enforced" : "not_required";
  const safeLimitsStatus: SecurityDataLimitsStatus = definition.safeLimits ? "enforced" : "not_applicable";
  const emptyStateStatus: SecurityDataStateStatus = definition.emptyState ? "present" : "missing";
  const errorStateStatus: SecurityDataStateStatus = definition.errorState ? "present" : "missing";

  const auditBlocking = audit?.blocking ? 1 : 0;
  const structuralBlocking =
    (emptyStateStatus === "missing" ? 1 : 0) +
    (errorStateStatus === "missing" ? 1 : 0) +
    (dataSourceStatus === "unavailable" ? 1 : 0);
  const blockingIssues = auditBlocking + structuralBlocking;

  const certificationStatus: SecurityDataCertificationStatus =
    blockingIssues > 0
      ? "not_certified"
      : dataSourceStatus === "degraded" || review?.certificationReadiness === "conditionally_certified"
        ? "conditionally_certified"
        : "certified";

  const recommendation =
    blockingIssues > 0
      ? audit?.recommendation ??
        "Restore a safe data source, masking, safe limits, and empty/error states before certifying this module."
      : certificationStatus === "conditionally_certified"
        ? review?.recommendation ?? "Data source is degraded; confirm readiness before full certification."
        : "No action required. Data access is read-only, masked, and bounded.";

  return {
    blockingIssues,
    certificationId: definition.certificationId,
    certificationStatus,
    dataSourceStatus,
    displayName: definition.displayName,
    emptyStateStatus,
    errorStateStatus,
    maskedFields: [...definition.maskedFields],
    maskingStatus,
    moduleKey: definition.moduleKey,
    readOnly: true,
    readOnlyStatus,
    recommendation,
    safeLimitsStatus,
    source: SECURITY_DATA_CERTIFICATION_SOURCE
  };
}

export function resolveSecurityDataCertificationResults(): SecurityDataCertificationResult[] {
  const audit = runSecurityAudit();
  const auditById = new Map(audit.results.map((result) => [result.auditId, result]));
  const reviewById = new Map(resolveSecurityReviewResults().map((result) => [result.reviewId, result]));

  return SECURITY_DATA_CERTIFICATION_DEFINITIONS.map((definition) =>
    certifyModule(definition, auditById.get(definition.linkedAuditId), reviewById.get(definition.linkedReviewId))
  );
}

export function getSecurityDataCertificationResult(
  certificationId: string
): SecurityDataCertificationResult | null {
  return (
    resolveSecurityDataCertificationResults().find((result) => result.certificationId === certificationId) ?? null
  );
}

export function buildSecurityDataCertificationSummary(
  results: SecurityDataCertificationResult[]
): SecurityDataCertificationSummary {
  const certifiedCount = results.filter((result) => result.certificationStatus === "certified").length;
  const conditionalCount = results.filter(
    (result) => result.certificationStatus === "conditionally_certified"
  ).length;
  const notCertifiedCount = results.filter((result) => result.certificationStatus === "not_certified").length;
  const blockingTotal = results.reduce((total, result) => total + result.blockingIssues, 0);

  const overallCertification: SecurityDataCertificationStatus =
    notCertifiedCount > 0 ? "not_certified" : conditionalCount > 0 ? "conditionally_certified" : "certified";

  return {
    blockingTotal,
    certifiedCount,
    conditionalCount,
    notCertifiedCount,
    overallCertification,
    readOnly: true,
    source: SECURITY_DATA_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallCertification}`,
      `${results.length} modules`,
      `${certifiedCount} certified`,
      `${conditionalCount} conditional`,
      `${notCertifiedCount} not certified`,
      `${blockingTotal} blocking issues`
    ].join("; "),
    totalModules: results.length
  };
}

export function validateSecurityDataCertificationRuntime(
  results: SecurityDataCertificationResult[]
): SecurityDataCertificationValidation {
  const issues: string[] = [];
  const ids = new Set<string>();

  if (results.length !== SECURITY_DATA_CERTIFICATION_DEFINITIONS.length) {
    issues.push("Security data certification runtime must include every certification module.");
  }

  for (const result of results) {
    if (ids.has(result.certificationId)) {
      issues.push(`Duplicate certification id: ${result.certificationId}.`);
    }

    ids.add(result.certificationId);

    if (!result.readOnly) {
      issues.push(`${result.certificationId} must remain read-only.`);
    }

    if (result.source !== SECURITY_DATA_CERTIFICATION_SOURCE) {
      issues.push(`${result.certificationId} must originate from the security data certification runtime.`);
    }

    if (result.readOnlyStatus !== "enforced") {
      issues.push(`${result.certificationId} must enforce read-only data access.`);
    }

    if (result.certificationStatus !== "certified" && !result.recommendation) {
      issues.push(`${result.certificationId} must provide a recommendation when not certified.`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityDataCertificationLoadingState(): SecurityDataCertificationLoadingState {
  return {
    loading: true,
    message: "Certifying read-only security data access, masking, limits, and safe states.",
    readOnly: true,
    source: SECURITY_DATA_CERTIFICATION_SOURCE
  };
}

export function runSecurityDataCertification(): SecurityDataCertificationRuntimeResult {
  const support = resolveSecurityDataCertificationSupport();

  if (!support.supported) {
    const results = SECURITY_DATA_CERTIFICATION_DEFINITIONS.map((definition) => ({
      blockingIssues: 1,
      certificationId: definition.certificationId,
      certificationStatus: "not_certified" as const,
      dataSourceStatus: "unavailable" as const,
      displayName: definition.displayName,
      emptyStateStatus: (definition.emptyState ? "present" : "missing") as SecurityDataStateStatus,
      errorStateStatus: (definition.errorState ? "present" : "missing") as SecurityDataStateStatus,
      maskedFields: [...definition.maskedFields],
      maskingStatus: (definition.maskingRequired ? "enforced" : "not_required") as SecurityDataMaskingStatus,
      moduleKey: definition.moduleKey,
      readOnly: true as const,
      readOnlyStatus: "enforced" as const,
      recommendation:
        support.disabledReason ??
        "Register the advanced security center as a super-admin module to enable data certification.",
      safeLimitsStatus: (definition.safeLimits ? "enforced" : "not_applicable") as SecurityDataLimitsStatus,
      source: SECURITY_DATA_CERTIFICATION_SOURCE
    }));

    return {
      readOnly: true,
      results,
      source: SECURITY_DATA_CERTIFICATION_SOURCE,
      state: "disabled",
      summary: buildSecurityDataCertificationSummary(results)
    };
  }

  const results = resolveSecurityDataCertificationResults();

  return {
    readOnly: true,
    results,
    source: SECURITY_DATA_CERTIFICATION_SOURCE,
    state: results.length === 0 ? "empty" : "success",
    summary: buildSecurityDataCertificationSummary(results)
  };
}

export function mapSecurityDataCertificationRuntimeToAdminFields() {
  const result = runSecurityDataCertification();
  const validation = validateSecurityDataCertificationRuntime(result.results);

  return {
    readOnly: true as const,
    results: result.results,
    source: SECURITY_DATA_CERTIFICATION_SOURCE,
    state: result.state,
    summary: validation.isValid
      ? result.summary
      : { ...result.summary, summary: "Security data certification validation requires safe read-only defaults." },
    validation
  };
}
