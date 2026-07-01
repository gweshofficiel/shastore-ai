import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry,
  type SecurityRuntimeStatus
} from "@/src/lib/security/security-registry-runtime";
import { runSecurityAudit } from "@/src/lib/security/security-audit-runtime";
import {
  runSecurityReview,
  type SecurityReviewResult
} from "@/src/lib/security/security-review-runtime";
import {
  runSecurityDataCertification,
  type SecurityDataCertificationResult
} from "@/src/lib/security/security-data-certification-runtime";
import {
  runSecuritySecurityCertification,
  type SecuritySecurityCertificationResult
} from "@/src/lib/security/security-security-certification-runtime";

export type SecurityRuntimeCertificationSource = "security_runtime_certification_runtime";

export type SecurityRuntimeCertificationRuntimeStatus = SecurityRuntimeStatus | "unavailable";

export type SecurityRuntimeCertificationCompatibility = "compatible" | "degraded" | "incompatible";

export type SecurityRuntimeCertificationReadOnly = "enforced" | "violation";

export type SecurityRuntimeCertificationSafety = "review_required" | "safe" | "unsafe";

export type SecurityRuntimeCertificationStatus = "certified" | "conditionally_certified" | "not_certified";

export type SecurityRuntimeCertificationState = "disabled" | "empty" | "success";

type SecurityRuntimeCertificationKind =
  | "meta_audit"
  | "meta_datacert"
  | "meta_review"
  | "meta_securitycert"
  | "review";

export type SecurityRuntimeCertificationDefinition = {
  certificationId: string;
  displayName: string;
  kind: SecurityRuntimeCertificationKind;
  linkedDataCertId?: string;
  linkedReviewId?: string;
  linkedSecurityCertId?: string;
  moduleKey: string;
};

export type SecurityRuntimeCertificationResult = {
  blockingIssuesCount: number;
  certificationId: string;
  certificationStatus: SecurityRuntimeCertificationStatus;
  compatibilityStatus: SecurityRuntimeCertificationCompatibility;
  displayName: string;
  moduleKey: string;
  readOnly: true;
  readOnlyStatus: SecurityRuntimeCertificationReadOnly;
  recommendation: string;
  runtimeStatus: SecurityRuntimeCertificationRuntimeStatus;
  safetyStatus: SecurityRuntimeCertificationSafety;
  source: SecurityRuntimeCertificationSource;
  warningsCount: number;
};

export type SecurityRuntimeCertificationSummary = {
  blockingTotal: number;
  certifiedCount: number;
  conditionalCount: number;
  notCertifiedCount: number;
  overallCertification: SecurityRuntimeCertificationStatus;
  productionReady: boolean;
  readOnly: true;
  source: SecurityRuntimeCertificationSource;
  summary: string;
  totalAreas: number;
  warningTotal: number;
};

export type SecurityRuntimeCertificationSupport = {
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityRuntimeCertificationSource;
  supported: boolean;
};

export type SecurityRuntimeCertificationValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityRuntimeCertificationRuntimeResult = {
  readOnly: true;
  results: SecurityRuntimeCertificationResult[];
  source: SecurityRuntimeCertificationSource;
  state: SecurityRuntimeCertificationState;
  summary: SecurityRuntimeCertificationSummary;
};

export type SecurityRuntimeCertificationLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityRuntimeCertificationSource;
};

export const SECURITY_RUNTIME_CERTIFICATION_SOURCE = "security_runtime_certification_runtime" as const;

export const SECURITY_RUNTIME_CERTIFICATION_REGISTRY_KEY = "sec-advanced-security-center" as const;

export const SECURITY_RUNTIME_CERTIFICATION_DISABLED_STATE =
  "Security Runtime Certification is not available in the current runtime configuration.";

export const SECURITY_RUNTIME_CERTIFICATION_DEFINITIONS: readonly SecurityRuntimeCertificationDefinition[] = [
  {
    certificationId: "sec-runtimecert-registry",
    displayName: "Security Registry",
    kind: "review",
    linkedReviewId: "sec-review-registry",
    moduleKey: "sec-advanced-security-center"
  },
  {
    certificationId: "sec-runtimecert-dashboard",
    displayName: "Security Dashboard",
    kind: "review",
    linkedReviewId: "sec-review-dashboard",
    moduleKey: "sec-advanced-security-center"
  },
  {
    certificationId: "sec-runtimecert-audit-logs",
    displayName: "Audit Logs",
    kind: "review",
    linkedDataCertId: "sec-cert-audit-logs",
    linkedReviewId: "sec-review-audit-logs",
    moduleKey: "sec-audit-logs"
  },
  {
    certificationId: "sec-runtimecert-login-monitoring",
    displayName: "Login Monitoring",
    kind: "review",
    linkedDataCertId: "sec-cert-login-monitoring",
    linkedReviewId: "sec-review-login-monitoring",
    moduleKey: "sec-login-monitoring"
  },
  {
    certificationId: "sec-runtimecert-ip-monitoring",
    displayName: "IP Monitoring",
    kind: "review",
    linkedDataCertId: "sec-cert-ip-monitoring",
    linkedReviewId: "sec-review-ip-monitoring",
    moduleKey: "sec-ip-monitoring"
  },
  {
    certificationId: "sec-runtimecert-device-monitoring",
    displayName: "Device Monitoring",
    kind: "review",
    linkedDataCertId: "sec-cert-device-monitoring",
    linkedReviewId: "sec-review-device-monitoring",
    moduleKey: "sec-device-monitoring"
  },
  {
    certificationId: "sec-runtimecert-abuse-detection",
    displayName: "Abuse Detection",
    kind: "review",
    linkedDataCertId: "sec-cert-abuse-detection",
    linkedReviewId: "sec-review-abuse-detection",
    moduleKey: "sec-abuse-detection"
  },
  {
    certificationId: "sec-runtimecert-fraud-detection",
    displayName: "Fraud Detection",
    kind: "review",
    linkedDataCertId: "sec-cert-fraud-detection",
    linkedReviewId: "sec-review-fraud-detection",
    moduleKey: "sec-fraud-detection"
  },
  {
    certificationId: "sec-runtimecert-rate-limits",
    displayName: "Rate Limits",
    kind: "review",
    linkedDataCertId: "sec-cert-rate-limits",
    linkedReviewId: "sec-review-rate-limits",
    moduleKey: "sec-rate-limits"
  },
  {
    certificationId: "sec-runtimecert-risk-score",
    displayName: "Risk Score",
    kind: "review",
    linkedDataCertId: "sec-cert-risk-score",
    linkedReviewId: "sec-review-risk-score",
    moduleKey: "sec-risk-score"
  },
  {
    certificationId: "sec-runtimecert-risk-levels",
    displayName: "Risk Levels",
    kind: "review",
    linkedDataCertId: "sec-cert-risk-levels",
    linkedReviewId: "sec-review-risk-levels",
    moduleKey: "sec-risk-levels"
  },
  {
    certificationId: "sec-runtimecert-security-events",
    displayName: "Security Events",
    kind: "review",
    linkedDataCertId: "sec-cert-security-events",
    linkedReviewId: "sec-review-security-events",
    moduleKey: "sec-security-events"
  },
  {
    certificationId: "sec-runtimecert-event-details",
    displayName: "Event Details",
    kind: "review",
    linkedDataCertId: "sec-cert-event-details",
    linkedReviewId: "sec-review-event-details",
    moduleKey: "sec-security-events"
  },
  {
    certificationId: "sec-runtimecert-safe-actions",
    displayName: "Safe Actions",
    kind: "review",
    linkedReviewId: "sec-review-safe-actions",
    linkedSecurityCertId: "sec-seccert-safe-action-guards",
    moduleKey: "sec-security-actions"
  },
  {
    certificationId: "sec-runtimecert-mark-reviewed",
    displayName: "Mark Reviewed",
    kind: "review",
    linkedReviewId: "sec-review-mark-reviewed",
    moduleKey: "sec-security-actions"
  },
  {
    certificationId: "sec-runtimecert-mark-high-risk",
    displayName: "Mark High Risk",
    kind: "review",
    linkedReviewId: "sec-review-mark-high-risk",
    moduleKey: "sec-security-actions"
  },
  {
    certificationId: "sec-runtimecert-clear-risk",
    displayName: "Clear Risk",
    kind: "review",
    linkedReviewId: "sec-review-clear-risk",
    moduleKey: "sec-security-actions"
  },
  {
    certificationId: "sec-runtimecert-user-suspend-shortcut",
    displayName: "User Suspend Shortcut",
    kind: "review",
    linkedReviewId: "sec-review-user-suspend-shortcut",
    moduleKey: "sec-security-actions"
  },
  {
    certificationId: "sec-runtimecert-store-suspend-shortcut",
    displayName: "Store Suspend Shortcut",
    kind: "review",
    linkedReviewId: "sec-review-store-suspend-shortcut",
    moduleKey: "sec-security-actions"
  },
  {
    certificationId: "sec-runtimecert-security-export",
    displayName: "Security Export",
    kind: "review",
    linkedDataCertId: "sec-cert-exports",
    linkedReviewId: "sec-review-security-export",
    linkedSecurityCertId: "sec-seccert-export-masking",
    moduleKey: "sec-security-actions"
  },
  {
    certificationId: "sec-runtimecert-future-hooks",
    displayName: "Future Hooks",
    kind: "review",
    linkedReviewId: "sec-review-future-hooks",
    moduleKey: "sec-future-hooks"
  },
  {
    certificationId: "sec-runtimecert-fraud-rules-engine",
    displayName: "Fraud Rules Engine",
    kind: "review",
    linkedReviewId: "sec-review-fraud-rules-engine",
    moduleKey: "sec-fraud-detection"
  },
  {
    certificationId: "sec-runtimecert-ip-blocklist",
    displayName: "IP Blocklist",
    kind: "review",
    linkedReviewId: "sec-review-ip-blocklist",
    moduleKey: "sec-ip-monitoring"
  },
  {
    certificationId: "sec-runtimecert-device-fingerprinting",
    displayName: "Device Fingerprinting",
    kind: "review",
    linkedReviewId: "sec-review-device-fingerprinting",
    moduleKey: "sec-device-monitoring"
  },
  {
    certificationId: "sec-runtimecert-automated-abuse-detection",
    displayName: "Automated Abuse Detection",
    kind: "review",
    linkedReviewId: "sec-review-automated-abuse-detection",
    moduleKey: "sec-abuse-detection"
  },
  {
    certificationId: "sec-runtimecert-security-alert-notifications",
    displayName: "Security Alert Notifications",
    kind: "review",
    linkedReviewId: "sec-review-security-alert-notifications",
    moduleKey: "sec-advanced-security-center"
  },
  {
    certificationId: "sec-runtimecert-export-audit-logs",
    displayName: "Export Audit Logs",
    kind: "review",
    linkedDataCertId: "sec-cert-exports",
    linkedReviewId: "sec-review-export-audit-logs",
    moduleKey: "sec-audit-logs"
  },
  {
    certificationId: "sec-runtimecert-search",
    displayName: "Search",
    kind: "review",
    linkedDataCertId: "sec-cert-search",
    linkedReviewId: "sec-review-search",
    linkedSecurityCertId: "sec-seccert-search-safety",
    moduleKey: "sec-advanced-security-center"
  },
  {
    certificationId: "sec-runtimecert-filters",
    displayName: "Filters",
    kind: "review",
    linkedDataCertId: "sec-cert-filters",
    linkedReviewId: "sec-review-filters",
    linkedSecurityCertId: "sec-seccert-filters-safety",
    moduleKey: "sec-advanced-security-center"
  },
  {
    certificationId: "sec-runtimecert-metrics",
    displayName: "Metrics",
    kind: "review",
    linkedDataCertId: "sec-cert-metrics",
    linkedReviewId: "sec-review-metrics",
    linkedSecurityCertId: "sec-seccert-metrics-safety",
    moduleKey: "sec-advanced-security-center"
  },
  {
    certificationId: "sec-runtimecert-visibility",
    displayName: "Visibility",
    kind: "review",
    linkedReviewId: "sec-review-visibility",
    moduleKey: "sec-advanced-security-center"
  },
  {
    certificationId: "sec-runtimecert-audit",
    displayName: "Audit",
    kind: "meta_audit",
    moduleKey: "sec-advanced-security-center"
  },
  {
    certificationId: "sec-runtimecert-review",
    displayName: "Review",
    kind: "meta_review",
    moduleKey: "sec-advanced-security-center"
  },
  {
    certificationId: "sec-runtimecert-data-certification",
    displayName: "Data Certification",
    kind: "meta_datacert",
    moduleKey: "sec-advanced-security-center"
  },
  {
    certificationId: "sec-runtimecert-security-certification",
    displayName: "Security Certification",
    kind: "meta_securitycert",
    moduleKey: "sec-advanced-security-center"
  }
] as const;

export function resolveSecurityRuntimeCertificationSupport(): SecurityRuntimeCertificationSupport {
  const registryEntry = getSecurityRegistryEntry(SECURITY_RUNTIME_CERTIFICATION_REGISTRY_KEY);

  const base = {
    readOnly: true as const,
    registryKey: SECURITY_RUNTIME_CERTIFICATION_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_RUNTIME_CERTIFICATION_SOURCE
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

function resolveRuntimeStatus(moduleKey: string): SecurityRuntimeCertificationRuntimeStatus {
  const entry = getSecurityRegistryEntry(moduleKey);
  return entry && entry.visibility === "super_admin" ? entry.runtimeStatus : "unavailable";
}

type SecurityRuntimeCertificationContext = {
  dataCertById: Map<string, SecurityDataCertificationResult>;
  metaAudit: { blocking: number; warnings: number };
  metaDataCert: { blocking: number; warnings: number };
  metaReview: { blocking: number; warnings: number };
  metaSecurityCert: { blocking: number; warnings: number };
  reviewById: Map<string, SecurityReviewResult>;
  securityCertById: Map<string, SecuritySecurityCertificationResult>;
};

type AggregatedSignals = {
  blocking: number;
  recommendation: string;
  runtimeStatus: SecurityRuntimeCertificationRuntimeStatus;
  safety: SecurityRuntimeCertificationSafety;
  warnings: number;
};

function deriveSafety(blocking: number, warnings: number): SecurityRuntimeCertificationSafety {
  if (blocking > 0) {
    return "unsafe";
  }

  return warnings > 0 ? "review_required" : "safe";
}

function aggregateReviewArea(
  definition: SecurityRuntimeCertificationDefinition,
  context: SecurityRuntimeCertificationContext
): AggregatedSignals {
  let blocking = 0;
  let warnings = 0;
  const recommendations: string[] = [];
  let runtimeStatus: SecurityRuntimeCertificationRuntimeStatus = resolveRuntimeStatus(definition.moduleKey);
  let safety: SecurityRuntimeCertificationSafety | null = null;

  const review = definition.linkedReviewId ? context.reviewById.get(definition.linkedReviewId) : undefined;

  if (review) {
    blocking += review.blockingIssuesCount;
    warnings += review.warningCount;
    runtimeStatus = review.runtimeStatus;
    safety = review.safetyStatus;

    if (review.certificationReadiness !== "certified") {
      recommendations.push(review.recommendation);
    }
  }

  const dataCert = definition.linkedDataCertId ? context.dataCertById.get(definition.linkedDataCertId) : undefined;

  if (dataCert) {
    blocking += dataCert.blockingIssues;

    if (dataCert.certificationStatus === "conditionally_certified") {
      warnings += 1;
    }

    if (dataCert.certificationStatus !== "certified") {
      recommendations.push(dataCert.recommendation);
    }
  }

  const securityCert = definition.linkedSecurityCertId
    ? context.securityCertById.get(definition.linkedSecurityCertId)
    : undefined;

  if (securityCert) {
    if (securityCert.blocking) {
      blocking += 1;
    }

    if (securityCert.status === "warn") {
      warnings += 1;
    }

    if (securityCert.status !== "pass") {
      recommendations.push(securityCert.recommendation);
    }
  }

  return {
    blocking,
    recommendation: recommendations.find((entry) => Boolean(entry)) ?? "No action required.",
    runtimeStatus,
    safety: safety ?? deriveSafety(blocking, warnings),
    warnings
  };
}

function aggregateMetaArea(
  definition: SecurityRuntimeCertificationDefinition,
  context: SecurityRuntimeCertificationContext
): AggregatedSignals {
  const signals =
    definition.kind === "meta_audit"
      ? context.metaAudit
      : definition.kind === "meta_review"
        ? context.metaReview
        : definition.kind === "meta_datacert"
          ? context.metaDataCert
          : context.metaSecurityCert;

  const recommendation =
    signals.blocking > 0
      ? `Resolve ${signals.blocking} blocking issue(s) in the ${definition.displayName} runtime before certification.`
      : signals.warnings > 0
        ? `Review ${signals.warnings} warning(s) in the ${definition.displayName} runtime.`
        : "No action required.";

  return {
    blocking: signals.blocking,
    recommendation,
    runtimeStatus: resolveRuntimeStatus(definition.moduleKey),
    safety: deriveSafety(signals.blocking, signals.warnings),
    warnings: signals.warnings
  };
}

function buildResult(
  definition: SecurityRuntimeCertificationDefinition,
  signals: AggregatedSignals
): SecurityRuntimeCertificationResult {
  const compatibilityStatus: SecurityRuntimeCertificationCompatibility =
    signals.blocking > 0 ? "incompatible" : signals.warnings > 0 ? "degraded" : "compatible";

  const certificationStatus: SecurityRuntimeCertificationStatus =
    signals.blocking > 0 ? "not_certified" : signals.warnings > 0 ? "conditionally_certified" : "certified";

  return {
    blockingIssuesCount: signals.blocking,
    certificationId: definition.certificationId,
    certificationStatus,
    compatibilityStatus,
    displayName: definition.displayName,
    moduleKey: definition.moduleKey,
    readOnly: true,
    readOnlyStatus: "enforced",
    recommendation: signals.recommendation,
    runtimeStatus: signals.runtimeStatus,
    safetyStatus: signals.safety,
    source: SECURITY_RUNTIME_CERTIFICATION_SOURCE,
    warningsCount: signals.warnings
  };
}

export function resolveSecurityRuntimeCertificationResults(): SecurityRuntimeCertificationResult[] {
  const review = runSecurityReview();
  const dataCertification = runSecurityDataCertification();
  const securityCertification = runSecuritySecurityCertification();
  const audit = runSecurityAudit();

  const context: SecurityRuntimeCertificationContext = {
    dataCertById: new Map(dataCertification.results.map((result) => [result.certificationId, result])),
    metaAudit: { blocking: audit.summary.blockingCount, warnings: audit.summary.warnCount },
    metaDataCert: { blocking: dataCertification.summary.blockingTotal, warnings: dataCertification.summary.conditionalCount },
    metaReview: { blocking: review.summary.blockingTotal, warnings: review.summary.warningTotal },
    metaSecurityCert: {
      blocking: securityCertification.summary.blockingCount,
      warnings: securityCertification.summary.warnCount
    },
    reviewById: new Map(review.results.map((result) => [result.reviewId, result])),
    securityCertById: new Map(securityCertification.results.map((result) => [result.certificationId, result]))
  };

  return SECURITY_RUNTIME_CERTIFICATION_DEFINITIONS.map((definition) => {
    const signals =
      definition.kind === "review"
        ? aggregateReviewArea(definition, context)
        : aggregateMetaArea(definition, context);

    return buildResult(definition, signals);
  });
}

export function getSecurityRuntimeCertificationResult(
  certificationId: string
): SecurityRuntimeCertificationResult | null {
  return (
    resolveSecurityRuntimeCertificationResults().find(
      (result) => result.certificationId === certificationId
    ) ?? null
  );
}

export function buildSecurityRuntimeCertificationSummary(
  results: SecurityRuntimeCertificationResult[]
): SecurityRuntimeCertificationSummary {
  const certifiedCount = results.filter((result) => result.certificationStatus === "certified").length;
  const conditionalCount = results.filter(
    (result) => result.certificationStatus === "conditionally_certified"
  ).length;
  const notCertifiedCount = results.filter(
    (result) => result.certificationStatus === "not_certified"
  ).length;
  const blockingTotal = results.reduce((total, result) => total + result.blockingIssuesCount, 0);
  const warningTotal = results.reduce((total, result) => total + result.warningsCount, 0);

  const overallCertification: SecurityRuntimeCertificationStatus =
    notCertifiedCount > 0 ? "not_certified" : conditionalCount > 0 ? "conditionally_certified" : "certified";

  return {
    blockingTotal,
    certifiedCount,
    conditionalCount,
    notCertifiedCount,
    overallCertification,
    productionReady: notCertifiedCount === 0 && blockingTotal === 0,
    readOnly: true,
    source: SECURITY_RUNTIME_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallCertification}`,
      `${results.length} areas`,
      `${certifiedCount} certified`,
      `${conditionalCount} conditional`,
      `${notCertifiedCount} not certified`,
      `${blockingTotal} blocking issues`
    ].join("; "),
    totalAreas: results.length,
    warningTotal
  };
}

export function validateSecurityRuntimeCertificationRuntime(
  results: SecurityRuntimeCertificationResult[]
): SecurityRuntimeCertificationValidation {
  const issues: string[] = [];
  const ids = new Set<string>();

  if (results.length !== SECURITY_RUNTIME_CERTIFICATION_DEFINITIONS.length) {
    issues.push("Security runtime certification must include every runtime area.");
  }

  for (const result of results) {
    if (ids.has(result.certificationId)) {
      issues.push(`Duplicate certification id: ${result.certificationId}.`);
    }

    ids.add(result.certificationId);

    if (!result.readOnly) {
      issues.push(`${result.certificationId} must remain read-only.`);
    }

    if (result.source !== SECURITY_RUNTIME_CERTIFICATION_SOURCE) {
      issues.push(`${result.certificationId} must originate from the security runtime certification runtime.`);
    }

    if (result.readOnlyStatus !== "enforced") {
      issues.push(`${result.certificationId} must enforce read-only page load behavior.`);
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

export function buildSecurityRuntimeCertificationLoadingState(): SecurityRuntimeCertificationLoadingState {
  return {
    loading: true,
    message: "Certifying read-only security runtime readiness across all completed security phases.",
    readOnly: true,
    source: SECURITY_RUNTIME_CERTIFICATION_SOURCE
  };
}

export function runSecurityRuntimeCertification(): SecurityRuntimeCertificationRuntimeResult {
  const support = resolveSecurityRuntimeCertificationSupport();

  if (!support.supported) {
    const results = SECURITY_RUNTIME_CERTIFICATION_DEFINITIONS.map((definition) => ({
      blockingIssuesCount: 1,
      certificationId: definition.certificationId,
      certificationStatus: "not_certified" as const,
      compatibilityStatus: "incompatible" as const,
      displayName: definition.displayName,
      moduleKey: definition.moduleKey,
      readOnly: true as const,
      readOnlyStatus: "enforced" as const,
      recommendation:
        support.disabledReason ??
        "Register the advanced security center as a super-admin module to enable runtime certification.",
      runtimeStatus: "unavailable" as const,
      safetyStatus: "review_required" as const,
      source: SECURITY_RUNTIME_CERTIFICATION_SOURCE,
      warningsCount: 0
    }));

    return {
      readOnly: true,
      results,
      source: SECURITY_RUNTIME_CERTIFICATION_SOURCE,
      state: "disabled",
      summary: buildSecurityRuntimeCertificationSummary(results)
    };
  }

  const results = resolveSecurityRuntimeCertificationResults();

  return {
    readOnly: true,
    results,
    source: SECURITY_RUNTIME_CERTIFICATION_SOURCE,
    state: results.length === 0 ? "empty" : "success",
    summary: buildSecurityRuntimeCertificationSummary(results)
  };
}

export function mapSecurityRuntimeCertificationRuntimeToAdminFields() {
  const result = runSecurityRuntimeCertification();
  const validation = validateSecurityRuntimeCertificationRuntime(result.results);

  return {
    readOnly: true as const,
    results: result.results,
    source: SECURITY_RUNTIME_CERTIFICATION_SOURCE,
    state: result.state,
    summary: validation.isValid
      ? result.summary
      : {
          ...result.summary,
          summary: "Security runtime certification validation requires safe read-only defaults."
        },
    validation
  };
}
