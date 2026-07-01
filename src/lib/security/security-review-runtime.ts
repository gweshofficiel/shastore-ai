import "server-only";

import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry,
  type SecurityRuntimeStatus
} from "@/src/lib/security/security-registry-runtime";
import {
  runSecurityAudit,
  validateSecurityAuditRuntime,
  type SecurityAuditResult
} from "@/src/lib/security/security-audit-runtime";

export type SecurityReviewSource = "security_review_runtime";

export type SecurityReviewReadiness = "not_ready" | "partial" | "ready";

export type SecurityReviewSafety = "review_required" | "safe" | "unsafe";

export type SecurityReviewRuntimeStatus = SecurityRuntimeStatus | "unavailable";

export type SecurityReviewCertification = "certified" | "conditionally_certified" | "not_certified";

export type SecurityReviewRuntimeState = "disabled" | "empty" | "success";

export type SecurityReviewDefinition = {
  displayName: string;
  linkedAuditIds: readonly string[];
  moduleKey: string;
  reviewId: string;
  useOverallAudit?: boolean;
};

export type SecurityReviewResult = {
  blockingIssuesCount: number;
  certificationReadiness: SecurityReviewCertification;
  displayName: string;
  moduleKey: string;
  readOnly: true;
  readinessStatus: SecurityReviewReadiness;
  recommendation: string;
  reviewId: string;
  runtimeStatus: SecurityReviewRuntimeStatus;
  safetyStatus: SecurityReviewSafety;
  source: SecurityReviewSource;
  warningCount: number;
};

export type SecurityReviewSummary = {
  blockingTotal: number;
  certifiedCount: number;
  conditionalCount: number;
  notCertifiedCount: number;
  overallCertification: SecurityReviewCertification;
  readOnly: true;
  source: SecurityReviewSource;
  summary: string;
  totalAreas: number;
  warningTotal: number;
};

export type SecurityReviewSupport = {
  disabledReason: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityReviewSource;
  supported: boolean;
};

export type SecurityReviewValidation = {
  isValid: boolean;
  issues: string[];
};

export type SecurityReviewRuntimeResult = {
  readOnly: true;
  results: SecurityReviewResult[];
  source: SecurityReviewSource;
  state: SecurityReviewRuntimeState;
  summary: SecurityReviewSummary;
};

export type SecurityReviewLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityReviewSource;
};

export const SECURITY_REVIEW_SOURCE = "security_review_runtime" as const;

export const SECURITY_REVIEW_REGISTRY_KEY = "sec-advanced-security-center" as const;

export const SECURITY_REVIEW_DISABLED_STATE =
  "Security Review is not available in the current runtime configuration.";

export const SECURITY_REVIEW_DEFINITIONS: readonly SecurityReviewDefinition[] = [
  {
    displayName: "Registry",
    linkedAuditIds: ["sec-audit-registry-completeness", "sec-audit-module-registration"],
    moduleKey: "sec-advanced-security-center",
    reviewId: "sec-review-registry"
  },
  {
    displayName: "Dashboard",
    linkedAuditIds: ["sec-audit-dashboard"],
    moduleKey: "sec-advanced-security-center",
    reviewId: "sec-review-dashboard"
  },
  {
    displayName: "Audit Logs",
    linkedAuditIds: ["sec-audit-audit-logs"],
    moduleKey: "sec-audit-logs",
    reviewId: "sec-review-audit-logs"
  },
  {
    displayName: "Login Monitoring",
    linkedAuditIds: ["sec-audit-login-monitoring"],
    moduleKey: "sec-login-monitoring",
    reviewId: "sec-review-login-monitoring"
  },
  {
    displayName: "IP Monitoring",
    linkedAuditIds: ["sec-audit-ip-monitoring"],
    moduleKey: "sec-ip-monitoring",
    reviewId: "sec-review-ip-monitoring"
  },
  {
    displayName: "Device Monitoring",
    linkedAuditIds: ["sec-audit-device-monitoring"],
    moduleKey: "sec-device-monitoring",
    reviewId: "sec-review-device-monitoring"
  },
  {
    displayName: "Abuse Detection",
    linkedAuditIds: ["sec-audit-abuse-detection"],
    moduleKey: "sec-abuse-detection",
    reviewId: "sec-review-abuse-detection"
  },
  {
    displayName: "Fraud Detection",
    linkedAuditIds: ["sec-audit-fraud-detection"],
    moduleKey: "sec-fraud-detection",
    reviewId: "sec-review-fraud-detection"
  },
  {
    displayName: "Rate Limits",
    linkedAuditIds: ["sec-audit-rate-limits"],
    moduleKey: "sec-rate-limits",
    reviewId: "sec-review-rate-limits"
  },
  {
    displayName: "Risk Score",
    linkedAuditIds: ["sec-audit-risk-score"],
    moduleKey: "sec-risk-score",
    reviewId: "sec-review-risk-score"
  },
  {
    displayName: "Risk Levels",
    linkedAuditIds: ["sec-audit-risk-levels"],
    moduleKey: "sec-risk-levels",
    reviewId: "sec-review-risk-levels"
  },
  {
    displayName: "Security Events",
    linkedAuditIds: ["sec-audit-security-events"],
    moduleKey: "sec-security-events",
    reviewId: "sec-review-security-events"
  },
  {
    displayName: "Event Details",
    linkedAuditIds: ["sec-audit-security-event-details"],
    moduleKey: "sec-security-events",
    reviewId: "sec-review-event-details"
  },
  {
    displayName: "Safe Actions",
    linkedAuditIds: ["sec-audit-security-safe-actions"],
    moduleKey: "sec-security-actions",
    reviewId: "sec-review-safe-actions"
  },
  {
    displayName: "Mark Reviewed",
    linkedAuditIds: ["sec-audit-security-safe-actions"],
    moduleKey: "sec-security-actions",
    reviewId: "sec-review-mark-reviewed"
  },
  {
    displayName: "Mark High Risk",
    linkedAuditIds: ["sec-audit-security-safe-actions"],
    moduleKey: "sec-security-actions",
    reviewId: "sec-review-mark-high-risk"
  },
  {
    displayName: "Clear Risk",
    linkedAuditIds: ["sec-audit-security-safe-actions"],
    moduleKey: "sec-security-actions",
    reviewId: "sec-review-clear-risk"
  },
  {
    displayName: "User Suspend Shortcut",
    linkedAuditIds: ["sec-audit-security-safe-actions"],
    moduleKey: "sec-security-actions",
    reviewId: "sec-review-user-suspend-shortcut"
  },
  {
    displayName: "Store Suspend Shortcut",
    linkedAuditIds: ["sec-audit-security-safe-actions"],
    moduleKey: "sec-security-actions",
    reviewId: "sec-review-store-suspend-shortcut"
  },
  {
    displayName: "Security Export",
    linkedAuditIds: ["sec-audit-security-export"],
    moduleKey: "sec-security-actions",
    reviewId: "sec-review-security-export"
  },
  {
    displayName: "Future Hooks",
    linkedAuditIds: ["sec-audit-future-hooks"],
    moduleKey: "sec-future-hooks",
    reviewId: "sec-review-future-hooks"
  },
  {
    displayName: "Fraud Rules Engine",
    linkedAuditIds: ["sec-audit-fraud-rules"],
    moduleKey: "sec-fraud-detection",
    reviewId: "sec-review-fraud-rules-engine"
  },
  {
    displayName: "IP Blocklist",
    linkedAuditIds: ["sec-audit-ip-blocklist"],
    moduleKey: "sec-ip-monitoring",
    reviewId: "sec-review-ip-blocklist"
  },
  {
    displayName: "Device Fingerprinting",
    linkedAuditIds: ["sec-audit-device-fingerprinting"],
    moduleKey: "sec-device-monitoring",
    reviewId: "sec-review-device-fingerprinting"
  },
  {
    displayName: "Automated Abuse Detection",
    linkedAuditIds: ["sec-audit-automated-abuse-detection"],
    moduleKey: "sec-abuse-detection",
    reviewId: "sec-review-automated-abuse-detection"
  },
  {
    displayName: "Security Alert Notifications",
    linkedAuditIds: ["sec-audit-security-alert-notifications"],
    moduleKey: "sec-advanced-security-center",
    reviewId: "sec-review-security-alert-notifications"
  },
  {
    displayName: "Export Audit Logs",
    linkedAuditIds: ["sec-audit-security-export", "sec-audit-audit-logs"],
    moduleKey: "sec-audit-logs",
    reviewId: "sec-review-export-audit-logs"
  },
  {
    displayName: "Search",
    linkedAuditIds: ["sec-audit-security-search"],
    moduleKey: "sec-advanced-security-center",
    reviewId: "sec-review-search"
  },
  {
    displayName: "Filters",
    linkedAuditIds: ["sec-audit-security-filters"],
    moduleKey: "sec-advanced-security-center",
    reviewId: "sec-review-filters"
  },
  {
    displayName: "Metrics",
    linkedAuditIds: ["sec-audit-security-metrics"],
    moduleKey: "sec-advanced-security-center",
    reviewId: "sec-review-metrics"
  },
  {
    displayName: "Visibility",
    linkedAuditIds: ["sec-audit-visibility-readiness"],
    moduleKey: "sec-advanced-security-center",
    reviewId: "sec-review-visibility"
  },
  {
    displayName: "Security Audit",
    linkedAuditIds: [],
    moduleKey: "sec-advanced-security-center",
    reviewId: "sec-review-security-audit",
    useOverallAudit: true
  }
] as const;

export function resolveSecurityReviewSupport(): SecurityReviewSupport {
  const registryEntry = getSecurityRegistryEntry(SECURITY_REVIEW_REGISTRY_KEY);

  const base = {
    readOnly: true as const,
    registryKey: SECURITY_REVIEW_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_REVIEW_SOURCE
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

function resolveRuntimeStatus(moduleKey: string): SecurityReviewRuntimeStatus {
  const entry = getSecurityRegistryEntry(moduleKey);
  return entry && entry.visibility === "super_admin" ? entry.runtimeStatus : "unavailable";
}

function reviewFromLinkedResults(
  definition: SecurityReviewDefinition,
  linkedResults: SecurityAuditResult[]
): SecurityReviewResult {
  const blockingIssuesCount = linkedResults.filter((result) => result.blocking).length;
  const failCount = linkedResults.filter((result) => result.status === "fail").length;
  const warningCount = linkedResults.filter((result) => result.status === "warn").length;
  const runtimeStatus = resolveRuntimeStatus(definition.moduleKey);

  const readinessStatus: SecurityReviewReadiness =
    failCount > 0 || blockingIssuesCount > 0 ? "not_ready" : warningCount > 0 ? "partial" : "ready";

  const safetyStatus: SecurityReviewSafety =
    blockingIssuesCount > 0
      ? "unsafe"
      : failCount > 0 || linkedResults.some((result) => result.status === "warn" && result.severity === "medium")
        ? "review_required"
        : "safe";

  const firstActionable = linkedResults.find((result) => result.status !== "pass");
  const recommendation = firstActionable?.recommendation ?? "No action required.";

  const certificationReadiness: SecurityReviewCertification =
    blockingIssuesCount > 0 || readinessStatus === "not_ready"
      ? "not_certified"
      : readinessStatus === "partial" || safetyStatus !== "safe"
        ? "conditionally_certified"
        : "certified";

  return {
    blockingIssuesCount,
    certificationReadiness,
    displayName: definition.displayName,
    moduleKey: definition.moduleKey,
    readOnly: true,
    readinessStatus,
    recommendation,
    reviewId: definition.reviewId,
    runtimeStatus,
    safetyStatus,
    source: SECURITY_REVIEW_SOURCE,
    warningCount
  };
}

export function resolveSecurityReviewResults(): SecurityReviewResult[] {
  const audit = runSecurityAudit();
  const auditValidation = validateSecurityAuditRuntime(audit.results);
  const byId = new Map(audit.results.map((result) => [result.auditId, result]));

  return SECURITY_REVIEW_DEFINITIONS.map((definition) => {
    if (definition.useOverallAudit) {
      const overall = reviewFromLinkedResults(definition, audit.results);

      if (!auditValidation.isValid) {
        return {
          ...overall,
          blockingIssuesCount: Math.max(overall.blockingIssuesCount, 1),
          certificationReadiness: "not_certified",
          readinessStatus: "not_ready",
          recommendation: `Resolve security audit validation issues: ${auditValidation.issues.join(" ")}`,
          safetyStatus: "review_required"
        };
      }

      return overall;
    }

    const linkedResults = definition.linkedAuditIds
      .map((auditId) => byId.get(auditId))
      .filter((result): result is SecurityAuditResult => Boolean(result));

    return reviewFromLinkedResults(definition, linkedResults);
  });
}

export function getSecurityReviewResult(reviewId: string): SecurityReviewResult | null {
  return resolveSecurityReviewResults().find((result) => result.reviewId === reviewId) ?? null;
}

export function buildSecurityReviewSummary(results: SecurityReviewResult[]): SecurityReviewSummary {
  const certifiedCount = results.filter((result) => result.certificationReadiness === "certified").length;
  const conditionalCount = results.filter(
    (result) => result.certificationReadiness === "conditionally_certified"
  ).length;
  const notCertifiedCount = results.filter((result) => result.certificationReadiness === "not_certified").length;
  const blockingTotal = results.reduce((total, result) => total + result.blockingIssuesCount, 0);
  const warningTotal = results.reduce((total, result) => total + result.warningCount, 0);

  const overallCertification: SecurityReviewCertification =
    notCertifiedCount > 0 ? "not_certified" : conditionalCount > 0 ? "conditionally_certified" : "certified";

  return {
    blockingTotal,
    certifiedCount,
    conditionalCount,
    notCertifiedCount,
    overallCertification,
    readOnly: true,
    source: SECURITY_REVIEW_SOURCE,
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

export function validateSecurityReviewRuntime(results: SecurityReviewResult[]): SecurityReviewValidation {
  const issues: string[] = [];
  const ids = new Set<string>();

  if (results.length !== SECURITY_REVIEW_DEFINITIONS.length) {
    issues.push("Security review runtime must include every review area.");
  }

  for (const result of results) {
    if (ids.has(result.reviewId)) {
      issues.push(`Duplicate review id: ${result.reviewId}.`);
    }

    ids.add(result.reviewId);

    if (!result.readOnly) {
      issues.push(`${result.reviewId} must remain read-only.`);
    }

    if (result.source !== SECURITY_REVIEW_SOURCE) {
      issues.push(`${result.reviewId} must originate from the security review runtime.`);
    }

    if (result.certificationReadiness !== "certified" && !result.recommendation) {
      issues.push(`${result.reviewId} must provide a recommendation when not certified.`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSecurityReviewLoadingState(): SecurityReviewLoadingState {
  return {
    loading: true,
    message: "Summarizing the read-only security runtime review from the security audit results.",
    readOnly: true,
    source: SECURITY_REVIEW_SOURCE
  };
}

export function runSecurityReview(): SecurityReviewRuntimeResult {
  const support = resolveSecurityReviewSupport();

  if (!support.supported) {
    const results = SECURITY_REVIEW_DEFINITIONS.map((definition) => ({
      blockingIssuesCount: 1,
      certificationReadiness: "not_certified" as const,
      displayName: definition.displayName,
      moduleKey: definition.moduleKey,
      readOnly: true as const,
      readinessStatus: "not_ready" as const,
      recommendation:
        support.disabledReason ?? "Register the advanced security center as a super-admin module to enable review.",
      reviewId: definition.reviewId,
      runtimeStatus: "unavailable" as const,
      safetyStatus: "review_required" as const,
      source: SECURITY_REVIEW_SOURCE,
      warningCount: 0
    }));

    return {
      readOnly: true,
      results,
      source: SECURITY_REVIEW_SOURCE,
      state: "disabled",
      summary: buildSecurityReviewSummary(results)
    };
  }

  const results = resolveSecurityReviewResults();

  return {
    readOnly: true,
    results,
    source: SECURITY_REVIEW_SOURCE,
    state: results.length === 0 ? "empty" : "success",
    summary: buildSecurityReviewSummary(results)
  };
}

export function mapSecurityReviewRuntimeToAdminFields() {
  const result = runSecurityReview();
  const validation = validateSecurityReviewRuntime(result.results);

  return {
    readOnly: true as const,
    results: result.results,
    source: SECURITY_REVIEW_SOURCE,
    state: result.state,
    summary: validation.isValid
      ? result.summary
      : { ...result.summary, summary: "Security review validation requires safe read-only defaults." },
    validation
  };
}
